"use client";

import { createContext, use, useEffect, useMemo, useRef } from "react";
import type { TabsStore } from "./store";

/**
 * Peek — a tab's content floating over the page without the tab being selected.
 *
 * The choreography is Shell's hover-peek, applied to a strip instead of an
 * edge, and it is almost entirely about *intent*. A pointer sweeps along a tab
 * strip all the time on its way to something else, so:
 *
 * - **Opening waits.** Only a pointer that rests on a tab for `peekDelay`
 *   opens it. A sweep across five tabs opens nothing.
 * - **Closing waits too.** Leaving the tab starts `peekCloseDelay`, which is
 *   what lets the pointer cross the gap into the surface; arriving there
 *   cancels it.
 * - **Once open, it follows.** Resting on a second tab while one is already
 *   peeked switches straight away — the intent was proven on the first.
 * - **Engaged means kept.** A pointerdown or focus inside the surface means
 *   someone is *using* it — typing, selecting text. From then on pointer drift
 *   cannot close it; Escape, a press outside, or selecting the tab can. This is
 *   the rule that matters most: a half-typed reply must never vanish because
 *   the cursor wandered off the edge.
 * - **Only a mouse hovers.** Touch has no hover, and a pen's is too
 *   incidental to act on. A tap is a press, and a press selects.
 *
 * A peek opened in code — a keyboard shortcut calling `setPeek` — was never
 * started by the pointer, so the pointer never ends it either.
 */

/** Long enough that sweeping along a strip opens nothing; Shell's edge uses 200. */
export const PEEK_OPEN_DELAY_MS = 300;
/** Long enough to cross the gap from the tab into the surface. Shell's value. */
export const PEEK_CLOSE_DELAY_MS = 250;

export type PeekControls = {
  /** The pointer came to rest on a peekable tab. */
  triggerEnter: (value: string, pointerType: string) => void;
  triggerLeave: () => void;
  surfaceEnter: () => void;
  surfaceLeave: () => void;
  /** Someone is using the surface — a press or focus inside it. */
  engage: () => void;
};

export const TabsPeekContext = createContext<PeekControls | null>(null);

export const usePeekControls = () => use(TabsPeekContext);

/**
 * Which channel the anchored parts follow: the selection, as they always have,
 * or the peek. Set by `<Tabs.Portal peek>` and read by everything inside it,
 * so the Positioner, Popup and Viewport need no prop of their own.
 */
export type TabsSurfaceChannel = "selection" | "peek";

export const TabsSurfaceChannelContext = createContext<TabsSurfaceChannel>("selection");

export const useSurfaceChannel = () => use(TabsSurfaceChannelContext);

/**
 * Who opened the current peek, and whether it has been engaged. Kept against
 * the value it describes, so a peek changed from outside — a controlled prop,
 * a `setPeek` from a shortcut — is recognised as not ours and left alone.
 *
 * A hover's claim is recorded as a *request* first, and becomes ownership only
 * when the store actually shows that peek. Uncontrolled, that is the same
 * instant. Controlled, the parent commits a render later — and a claim taken
 * eagerly would be wiped by the first `sync()` in between, leaving a peek the
 * pointer opened but can never close.
 */
type Ownership = { value: string | null; byHover: boolean; engaged: boolean };

export const usePeekChoreography = (
  store: TabsStore,
  delays: { open: number; close: number },
): PeekControls => {
  const openTimer = useRef<number | undefined>(undefined);
  const closeTimer = useRef<number | undefined>(undefined);
  const owner = useRef<Ownership>({ value: null, byHover: false, engaged: false });
  /** The peek a hover asked for and the store has not shown yet. */
  const requested = useRef<string | null>(null);
  const delaysRef = useRef(delays);
  delaysRef.current = delays;

  const { controls, onBlur } = useMemo((): { controls: PeekControls; onBlur: () => void } => {
    const clear = (timer: { current: number | undefined }) => {
      if (timer.current !== undefined) window.clearTimeout(timer.current);
      timer.current = undefined;
    };

    /** Bring the ownership record up to date with whatever the store now says. */
    const sync = () => {
      const peek = store.getSnapshot().peek;
      if (owner.current.value !== peek) {
        // Ours only if it is the one a hover asked for.
        const byHover = peek !== null && peek === requested.current;
        if (peek !== null) requested.current = null;
        owner.current = { value: peek, byHover, engaged: false };
      }
      return owner.current;
    };

    const peekByHover = (value: string) => {
      const { value: selected, disabled, peek } = store.getSnapshot();
      // The store refuses these, so there is nothing to ask for — and nothing
      // to claim. Checked here rather than inferred from the snapshot after
      // asking, which a controlled parent has not updated yet.
      if (value === peek || value === selected || disabled.has(value)) return;
      requested.current = value;
      store.getSnapshot().setPeek(value);
      sync();
    };

    const scheduleClose = () => {
      const current = sync();
      if (current.value === null || !current.byHover || current.engaged) return;
      clear(closeTimer);
      closeTimer.current = window.setTimeout(() => {
        closeTimer.current = undefined;
        // Re-read: it may have been engaged, or replaced, during the delay.
        const latest = sync();
        if (latest.value === null || !latest.byHover || latest.engaged) return;
        store.getSnapshot().setPeek(null);
      }, delaysRef.current.close);
    };

    const controls: PeekControls = {
      triggerEnter: (value, pointerType) => {
        if (pointerType !== "mouse") return;
        clear(closeTimer);

        const current = sync();
        if (current.value === value) return;
        // Someone is using the open peek, or code opened it: a pointer passing
        // over another tab is not a reason to take it away.
        if (current.value !== null && (current.engaged || !current.byHover)) return;

        clear(openTimer);
        if (current.value !== null) {
          peekByHover(value);
          return;
        }
        openTimer.current = window.setTimeout(() => {
          openTimer.current = undefined;
          peekByHover(value);
        }, delaysRef.current.open);
      },
      triggerLeave: () => {
        clear(openTimer);
        scheduleClose();
      },
      surfaceEnter: () => clear(closeTimer),
      surfaceLeave: scheduleClose,
      engage: () => {
        const current = sync();
        if (current.value === null) return;
        current.engaged = true;
        clear(closeTimer);
      },
    };

    // Cmd-Tab away mid-peek fires no pointerleave, so without this a peek
    // nobody engaged would still be floating when the window comes back. Shell
    // does the same for its hotspot. Timers go too: nothing should open into a
    // window you have just left.
    const onBlur = () => {
      clear(openTimer);
      const current = sync();
      if (current.value === null || !current.byHover || current.engaged) return;
      store.getSnapshot().setPeek(null);
    };

    return { controls, onBlur };
  }, [store]);

  useEffect(() => {
    window.addEventListener("blur", onBlur);
    return () => {
      window.removeEventListener("blur", onBlur);
      window.clearTimeout(openTimer.current);
      window.clearTimeout(closeTimer.current);
    };
  }, [onBlur]);

  return controls;
};
