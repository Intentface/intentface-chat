"use client";

import type { RefObject } from "react";
import { createContext, use, useSyncExternalStore } from "react";

/**
 * Shell store — all reactive shell state in one closure, so `useShell` can
 * offer selectors and a component re-renders only for the value it reads.
 * Not React state and not Zustand: a plain object with `subscribe` and
 * `getSnapshot`, read through `useSyncExternalStore`.
 *
 * The factory takes no arguments. Everything configurable is either a
 * `Shell.Root` prop (`defaultOpen`) seeded through `hydrate()` before the first
 * paint, or — for anything dimensional — CSS.
 *
 * Nothing is persisted here. `open` goes out through `onOpenChange` and comes
 * back as `defaultOpen`; the measured width goes out through `Shell.Sidebar`'s
 * `onResize` and comes back as **CSS** — the custom property, which is
 * where the width lives anyway. Where any of it is kept is the app's business,
 * and the package needs no opinion about serialisation, keys or cookie flags.
 *
 * **Width is not owned here.** The sidebar's size, and the range it may be
 * dragged through, are `width` / `min-width` / `max-width` in the consumer's
 * stylesheet. The browser clamps; this store only records what the element
 * actually measured, because persistence and `aria-valuenow` need a number.
 * Measure in JS, size in CSS.
 *
 * Instance model: every `Shell.Root` owns a store — an explicit
 * `Shell.createStore()` handle, or one created per mount — and provides it on
 * `ShellStoreContext`. Inside the tree `useShell` resolves it implicitly;
 * outside, `useShellStore(handle, selector)` takes the handle explicitly.
 * There is deliberately **no global fallback**, so shell state is never read
 * or driven by accident from somewhere that just happened to import this.
 *
 * SSR-safe by invariant: every write happens in an effect, an event handler,
 * or `hydrate()` before anything has subscribed — so a server render only ever
 * sees the pristine snapshot and one getter serves both sides of hydration.
 */

export type ShellState = {
  open: boolean;
  /** The collapsed sidebar floating over the content on hover. Never persisted. */
  peek: boolean;
  /** True for the duration of a resize drag, so parts can suppress transitions. */
  resizing: boolean;
  /** Measured from the sidebar element. Null until it has mounted. */
  width: number | null;

  setOpen: (open: boolean) => void;
  toggle: () => void;
  setPeek: (peek: boolean) => void;
  setResizing: (resizing: boolean) => void;
  /** Reports a measurement. Not a request to resize — CSS decides the size. */
  setWidth: (width: number) => void;
};

export type ShellStore = {
  subscribe: (listener: () => void) => () => void;
  getSnapshot: () => ShellState;

  // --- Bridges the Root wires up. Not consumer API.
  /**
   * Seed state before the first render commits: no notify and no report back,
   * because nothing has subscribed yet and re-announcing what we just restored
   * is pointless. This is how `defaultOpen` reaches the store without a flash.
   */
  hydrate: (state: { open?: boolean }) => void;
  /** Set while `open` is a controlled prop, which makes `setOpen` report-only. */
  controlledRef: RefObject<boolean>;
  onOpenChangeRef: RefObject<((open: boolean) => void) | null>;
  /** Reports a settled size — never the per-frame values a drag produces. */
  onResizeRef: RefObject<((width: number) => void) | null>;
  /** Commits `open` past the controlled guard — how the Root syncs its prop in. */
  commitOpen: (open: boolean) => void;
  /**
   * The mounted `Shell.Root`'s element. The width custom property is written
   * here rather than on the sidebar, so siblings — an in-flow spacer holding
   * the sidebar's place while it floats, say — can read the same value.
   */
  rootRef: RefObject<HTMLElement | null>;
  /**
   * The mounted `Shell.Sidebar`'s element, registered by its ref. The resize
   * handle sizes and measures it; the trigger points `aria-controls` at its id.
   */
  sidebarRef: RefObject<HTMLElement | null>;
  /**
   * Stable per-instance id for the sidebar, assigned by the mounting
   * `Shell.Root` from React's `useId` (SSR-stable). The factory can't mint it,
   * because explicit handles are created outside React.
   */
  sidebarId: string;
  /**
   * Set while collapsing, so a panel sliding out from under a parked pointer
   * doesn't bounce straight back as a peek. Cleared once the pointer leaves
   * the edge strip. Imperative, not reactive.
   */
  peekSuppressionRef: RefObject<boolean>;
};

export const createShellStore = (): ShellStore => {
  const listeners = new Set<() => void>();
  const notify = () => {
    for (const listener of listeners) listener();
  };

  const controlledRef: RefObject<boolean> = { current: false };
  const onOpenChangeRef: RefObject<((open: boolean) => void) | null> = { current: null };
  const onResizeRef: RefObject<((width: number) => void) | null> = { current: null };
  const peekSuppressionRef: RefObject<boolean> = { current: false };
  const rootRef: RefObject<HTMLElement | null> = { current: null };
  const sidebarRef: RefObject<HTMLElement | null> = { current: null };

  let snapshot: ShellState;

  // A drag emits a measurement per frame, and reporting each one would hand the
  // app a hundred sizes the user is still in the middle of choosing.
  // `setResizing(false)` reports whatever it landed on.
  const reportResize = () => {
    if (snapshot.resizing || snapshot.width === null) return;
    onResizeRef.current?.(snapshot.width);
  };

  const commitOpen = (open: boolean) => {
    if (snapshot.open === open) return;
    // Collapsing arms the bounce-back guard: a panel sliding out from under a
    // parked pointer must not immediately float back as a peek.
    if (!open) peekSuppressionRef.current = true;
    // Peek only means anything while collapsed, so opening ends it.
    snapshot = { ...snapshot, open, peek: open ? false : snapshot.peek };
    notify();
  };

  const setOpen = (open: boolean) => {
    // Reported before the commit, and the only effect while controlled: whoever
    // owns the prop decides, then pushes the result back through commitOpen.
    onOpenChangeRef.current?.(open);
    if (!controlledRef.current) commitOpen(open);
  };

  const toggle = () => setOpen(!snapshot.open);

  const setPeek = (peek: boolean) => {
    // There is nothing to peek at while the sidebar is already open.
    const next = peek && !snapshot.open;
    if (snapshot.peek === next) return;
    snapshot = { ...snapshot, peek: next };
    notify();
  };

  const setWidth = (width: number) => {
    if (snapshot.width === width) return;
    snapshot = { ...snapshot, width };
    notify();
    reportResize();
  };

  const setResizing = (resizing: boolean) => {
    if (snapshot.resizing === resizing) return;
    snapshot = { ...snapshot, resizing };
    notify();
    if (!resizing) reportResize();
  };

  snapshot = {
    open: true,
    peek: false,
    resizing: false,
    width: null,
    setOpen,
    toggle,
    setPeek,
    setResizing,
    setWidth,
  };

  return {
    subscribe: (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    getSnapshot: () => snapshot,
    hydrate: ({ open }) => {
      // Width is deliberately not seedable: it is a *measurement*, and CSS has
      // already decided the number before anything here runs.
      snapshot = { ...snapshot, open: open ?? snapshot.open };
    },
    rootRef,
    sidebarRef,
    sidebarId: "",
    controlledRef,
    onOpenChangeRef,
    onResizeRef,
    commitOpen,
    peekSuppressionRef,
  };
};

// ---------------------------------------------------------------------------
// Instance resolution — the nearest Shell.Root, explicitly.
// ---------------------------------------------------------------------------

export const ShellStoreContext = createContext<ShellStore | null>(null);

/** Internal: parts resolve the store their Shell.Root provided. */
export const useShellContextStore = () => {
  const store = use(ShellStoreContext);
  if (!store) throw new Error("Shell parts must be used within <Shell.Root>");
  return store;
};

/**
 * Subscribe to an explicit `Shell.createStore()` handle — the
 * outside-the-tree twin of `useShell`, for command palettes, global shortcut
 * handlers and anything else that isn't a descendant. Wrap it once per
 * instance to drop the argument at call sites:
 *
 *   const useAppShell = <T,>(selector: (shell: ShellState) => T) =>
 *     useShellStore(appShellStore, selector);
 */
export const useShellStore = <Selected = ShellState>(
  store: ShellStore,
  selector?: (shell: ShellState) => Selected,
): Selected => {
  const getValue = () => {
    const state = store.getSnapshot();
    // Safe: without a selector, Selected defaults to ShellState.
    return selector ? selector(state) : (state as Selected);
  };
  return useSyncExternalStore(store.subscribe, getValue, getValue);
};

/**
 * Subscribe to shell state from inside the tree. With a selector the component
 * re-renders only when that value changes; without one it re-renders on any
 * change. The actions are part of the snapshot and their identities never
 * change, so selecting one never causes a render.
 */
export const useShell = <Selected = ShellState>(selector?: (shell: ShellState) => Selected) =>
  useShellStore(useShellContextStore(), selector);
