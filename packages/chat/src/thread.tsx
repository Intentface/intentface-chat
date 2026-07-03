"use client";

// Headless thread: the scroll subsystem (at-bottom detection, auto-scroll
// landing/follow, composer-inset measurement) plus unstyled structural parts.
// The only styles emitted are behavior-critical (positioning/overflow/sentinel
// size), applied inline; everything visual belongs to the styled layer.
//
// Styled-layer contract: Thread.Content sets --thread-turn-min-height while an
// auto-scroll mode is active; map it onto the last child's min-height (e.g.
// `[&>*:last-child]:min-h-(--thread-turn-min-height,0px)`) so the newest turn
// can land at the top.

import {
  createContext,
  type KeyboardEvent,
  memo,
  type ReactNode,
  type RefObject,
  use,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useSyncExternalStore,
} from "react";
import type { PrimitiveProps } from "./internal/primitive-props";
import type { StateAttributesMapping } from "./internal/render/getStateAttributesProps";
import { useRefWithInit } from "./internal/render/useRefWithInit";
import { useRenderElement } from "./internal/render/useRenderElement";

// ---------------------------------------------------------------------------
// At-bottom store — external so an at-bottom flip re-renders only the
// components that actually read isAtBottom (via useThread), never the Thread
// tree itself: the context value stays referentially stable for the lifetime
// of the thread.
// ---------------------------------------------------------------------------

const createAtBottomStore = () => {
  let snapshot = true;
  const listeners = new Set<() => void>();
  return {
    getSnapshot: () => snapshot,
    setSnapshot: (next: boolean) => {
      if (snapshot === next) return;
      snapshot = next;
      for (const listener of listeners) listener();
    },
    subscribe: (listener: () => void) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
};

type AtBottomStore = ReturnType<typeof createAtBottomStore>;

// ---------------------------------------------------------------------------
// Thread context — a small, generic primitive surface. Auto-scroll behavior is
// driven by the <Thread autoScroll> prop; nothing here knows about chats or
// messages beyond the opt-in data-message-id row contract.
// ---------------------------------------------------------------------------

export type ThreadScrollToMessageOptions = {
  /** Viewport edge (or center) to align the row to; scrollIntoView's block. */
  align?: "start" | "center" | "end" | "nearest";
  behavior?: ScrollBehavior;
};

type ThreadContextValue = {
  atBottomStore: AtBottomStore;
  scrollToBottom: (behavior?: ScrollBehavior) => void;
  scrollToTop: (behavior?: ScrollBehavior) => void;
  scrollToMessage: (messageId: string, options?: ThreadScrollToMessageOptions) => boolean;
  releaseFollow: () => void;
  scrollRef: RefObject<HTMLDivElement | null>;
  contentRef: RefObject<HTMLDivElement | null>;
  sentinelRef: RefObject<HTMLDivElement | null>;
};

const ThreadContext = createContext<ThreadContextValue | null>(null);

const useThreadContext = () => {
  const ctx = use(ThreadContext);
  if (!ctx) throw new Error("useThread must be used within <Thread>");
  return ctx;
};

/**
 * Public thread surface. Subscribes to at-bottom, so call it where isAtBottom
 * is actually read (e.g. a scroll button); the commands and refs are stable
 * and never cause re-renders on their own.
 */
export const useThread = () => {
  const {
    atBottomStore,
    scrollToBottom,
    scrollToTop,
    scrollToMessage,
    scrollRef,
    contentRef,
    sentinelRef,
  } = useThreadContext();
  const isAtBottom = useSyncExternalStore(
    atBottomStore.subscribe,
    atBottomStore.getSnapshot,
    atBottomStore.getSnapshot,
  );
  return {
    isAtBottom,
    scrollToBottom,
    scrollToTop,
    scrollToMessage,
    scrollRef,
    contentRef,
    sentinelRef,
  };
};

// Single place that performs the scroll, so callers just choose the behavior:
// 'instant' for jumps that must not animate, 'smooth' for deliberate movements.
const scrollContainerTo = (el: HTMLElement, top: number, behavior: ScrollBehavior) => {
  el.scrollTo({ top, behavior });
};

// ---------------------------------------------------------------------------
// useThreadScroll — owns the thread's scroll subsystem: the scroll/content/
// sentinel refs, at-bottom detection, the scroll commands, and the autoScroll
// landing/follow behavior. Returns the value for ThreadContext. autoScroll modes:
//   "off"    no landing, no follow, no reserve — a plain scroll area.
//   "bottom" newest lands at the bottom and the view follows the stream (Codex).
//   "jump"   newest lands at the top (reserve); the view does not follow.
//   "follow" newest lands at the top and the view follows the stream (ChatGPT).
// Every active mode lands the newest turn on send; the reserve lifts the landing
// point to the top, follow tracks streaming growth. The landing runs in a layout
// effect so the initial land + reserve apply before paint (no top-then-jump
// flash); it runs after useThreadInsets in ThreadRoot, so --thread-turn-area is
// set before the reserve references it.
//
// The follow is released by deliberate reading intent — a wheel/touch/scroll-key
// gesture on the viewport, or the sentinel leaving view outside a programmatic
// scroll (a scrollbar drag) — and re-armed whenever the sentinel comes back into
// view. Content growth alone can never release it: every scroll we start marks
// autoScrollingRef, so the sentinel briefly leaving view mid-animation (a large
// code block landing at once, a stream outrunning the smooth scroll) is not
// mistaken for the user scrolling away.
// ---------------------------------------------------------------------------

export type ThreadAutoScrollMode = "off" | "bottom" | "jump" | "follow";

// Keys that scroll the viewport and therefore count as deliberate reading
// intent, releasing the follow.
const USER_SCROLL_KEYS = new Set([
  "ArrowDown",
  "ArrowUp",
  "End",
  "Home",
  "PageDown",
  "PageUp",
  " ",
]);

// How long after a programmatic scroll the sentinel may leave view without
// releasing the follow. Cleared earlier by scrollend where supported; the
// timeout is the Safari fallback.
const AUTO_SCROLL_SETTLE_MS = 200;

const useThreadScroll = (mode: ThreadAutoScrollMode): ThreadContextValue => {
  const scrollRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);

  // "At the bottom" = the bottom sentinel is in view. IntersectionObserver
  // computes it off the main thread (no scrollTop/scrollHeight reads); it
  // drives the scroll button and re-arms the follow.
  const atBottomStore = useRefWithInit(createAtBottomStore).current;

  // Follow intent: true while the view should track streaming growth.
  const followingRef = useRef(true);

  // True while a scroll we started may still be in flight.
  const autoScrollingRef = useRef(false);
  const autoScrollingTimeoutRef = useRef<number | null>(null);

  const markAutoScrolling = useCallback(() => {
    autoScrollingRef.current = true;
    if (autoScrollingTimeoutRef.current !== null) {
      window.clearTimeout(autoScrollingTimeoutRef.current);
    }
    autoScrollingTimeoutRef.current = window.setTimeout(() => {
      autoScrollingTimeoutRef.current = null;
      autoScrollingRef.current = false;
    }, AUTO_SCROLL_SETTLE_MS);
  }, []);

  useEffect(() => {
    const root = scrollRef.current;
    const sentinel = sentinelRef.current;
    if (!root || !sentinel) return;

    const io = new IntersectionObserver(
      ([entry]) => {
        const isAtBottom = entry?.isIntersecting ?? true;
        atBottomStore.setSnapshot(isAtBottom);
        if (isAtBottom) {
          followingRef.current = true;
        } else if (!autoScrollingRef.current) {
          // The sentinel left view and we didn't cause it: a scrollbar drag or
          // a momentum scroll away. Wheel/touch/keys release via the viewport's
          // gesture handlers before this even fires.
          followingRef.current = false;
        }
      },
      { root },
    );
    io.observe(sentinel);

    // A finished scroll means nothing of ours is in flight anymore; clear
    // early instead of waiting out the timeout fallback.
    const settle = () => {
      autoScrollingRef.current = false;
      if (autoScrollingTimeoutRef.current !== null) {
        window.clearTimeout(autoScrollingTimeoutRef.current);
        autoScrollingTimeoutRef.current = null;
      }
    };
    root.addEventListener("scrollend", settle);

    return () => {
      io.disconnect();
      root.removeEventListener("scrollend", settle);
      if (autoScrollingTimeoutRef.current !== null) {
        window.clearTimeout(autoScrollingTimeoutRef.current);
        autoScrollingTimeoutRef.current = null;
      }
    };
  }, [atBottomStore]);

  const scrollToBottom = useCallback(
    (behavior: ScrollBehavior = "smooth") => {
      const el = scrollRef.current;
      if (!el) return;
      markAutoScrolling();
      scrollContainerTo(el, el.scrollHeight, behavior);
    },
    [markAutoScrolling],
  );

  // Scrolling to the top is a deliberate move away from the live end, so it
  // releases the follow; reaching the bottom again re-arms it.
  const scrollToTop = useCallback(
    (behavior: ScrollBehavior = "smooth") => {
      const el = scrollRef.current;
      if (!el) return;
      followingRef.current = false;
      markAutoScrolling();
      scrollContainerTo(el, 0, behavior);
    },
    [markAutoScrolling],
  );

  // Jump to a row by its consumer-provided data-message-id. Resolved lazily at
  // call time — no per-row registration, nothing on the hot path. Returns false
  // when the id isn't mounted. scrollIntoView handles the alignment math and
  // honors any scroll-margin the styled layer sets on rows.
  const scrollToMessage = useCallback(
    (messageId: string, options: ThreadScrollToMessageOptions = {}) => {
      const row = contentRef.current?.querySelector<HTMLElement>(
        `[data-message-id="${CSS.escape(messageId)}"]`,
      );
      if (!row) return false;
      followingRef.current = false;
      markAutoScrolling();
      row.scrollIntoView({
        block: options.align ?? "start",
        inline: "nearest",
        behavior: options.behavior ?? "smooth",
      });
      return true;
    },
    [markAutoScrolling],
  );

  const releaseFollow = useCallback(() => {
    followingRef.current = false;
  }, []);

  useLayoutEffect(() => {
    const content = contentRef.current;
    if (!content || mode === "off") return;

    const landsAtTop = mode !== "bottom";
    const followsStream = mode !== "jump";

    // Reserve a viewport on the last turn so the newest lands at the top.
    if (landsAtTop) {
      content.style.setProperty("--thread-turn-min-height", "var(--thread-turn-area)");
    }

    // First land (and chat switches) jump instantly; later turns animate. A
    // land is a deliberate move to the live end, so it re-arms the follow.
    let landed = false;
    let skipNextResize = true;
    const land = (mutations: MutationRecord[] = []) => {
      const replaced = mutations.some((m) => m.removedNodes.length > 0);
      skipNextResize = true;
      followingRef.current = true;
      scrollToBottom(landed && !replaced ? "smooth" : "instant");
      landed = true;
    };

    // Follow streaming growth, but skip the resize our own land just caused
    // and yield once the follow is released. The `|| at bottom` keeps a
    // gesture that never leaves the bottom (a wheel nudge at the end) from
    // stranding the view unfollowed while visually pinned there.
    const follow = () => {
      if (skipNextResize) {
        skipNextResize = false;
        return;
      }
      if (followingRef.current || atBottomStore.getSnapshot()) {
        scrollToBottom("smooth");
      }
    };

    land();
    const turns = new MutationObserver(land);
    turns.observe(content, { childList: true });

    const growth = followsStream ? new ResizeObserver(follow) : null;
    growth?.observe(content);

    return () => {
      turns.disconnect();
      growth?.disconnect();
      if (landsAtTop) content.style.removeProperty("--thread-turn-min-height");
    };
  }, [mode, scrollToBottom, atBottomStore]);

  return useMemo(
    () => ({
      atBottomStore,
      scrollToBottom,
      scrollToTop,
      scrollToMessage,
      releaseFollow,
      scrollRef,
      contentRef,
      sentinelRef,
    }),
    [atBottomStore, scrollToBottom, scrollToTop, scrollToMessage, releaseFollow],
  );
};

// ---------------------------------------------------------------------------
// Insets
// ---------------------------------------------------------------------------

// Fallback (px) until the composer is measured.
const DEFAULT_BOTTOM_OFFSET = 128;
// Breathing room between the last line of content and the composer dock. The
// bottom overlay spans it in the styled layer.
const COMPOSER_GAP = 32;
const DOCK_SELECTOR = '[data-slot="composer-context-window"], [data-slot="composer-container"]';

/**
 * Height (px) to reserve at the bottom for the composer dock (context window +
 * attachments + input) — but NOT the command-list / ask-user panel. The
 * composer is bottom-anchored, so the dock sits in a fixed region while the
 * panel grows upward above it; measuring from the dock's top to the root's
 * bottom captures the former and ignores the latter. Returns null when no dock
 * is mounted yet.
 */
const measureComposerInset = (root: HTMLElement): number | null => {
  const dock = root.querySelector('[data-slot="composer-container"]');
  if (!dock) return null;
  return Math.round(
    root.getBoundingClientRect().bottom - dock.getBoundingClientRect().top + COMPOSER_GAP,
  );
};

// Top inset reserved by the top overlay, measured straight off the rendered
// element (px) — no getComputedStyle / rem→px conversion. 0 if no top overlay.
const measureTopInset = (root: HTMLElement): number =>
  root.querySelector('[data-slot="thread-overlay-top"]')?.getBoundingClientRect().height ?? 0;

/**
 * Writes the measured insets to CSS vars on the root via a ResizeObserver — no
 * React state, so composer growth never re-renders the thread:
 *   --thread-overlay-bottom-height drives the bottom overlay + viewport padding;
 *   --thread-turn-area is the visible thread area (root − top − bottom). When an
 *   auto-scroll mode is active, useThreadScroll maps the last turn's reserve
 *   (--thread-turn-min-height) to it; otherwise the reserve falls back to 0.
 * Recomputes only on root (window) / composer-dock resize — never per token.
 */
const useThreadInsets = () => {
  const rootRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    const apply = () => {
      const bottomInset = measureComposerInset(root);
      if (bottomInset !== null) {
        root.style.setProperty("--thread-overlay-bottom-height", `${bottomInset}px`);
      }
      const topInset = measureTopInset(root);
      const area = Math.max(
        0,
        Math.round(root.clientHeight - topInset - (bottomInset ?? DEFAULT_BOTTOM_OFFSET)),
      );
      root.style.setProperty("--thread-turn-area", `${area}px`);
    };

    apply();
    const observer = new ResizeObserver(apply);
    observer.observe(root);
    for (const part of root.querySelectorAll(DOCK_SELECTOR)) {
      observer.observe(part);
    }
    return () => observer.disconnect();
  }, []);

  return rootRef;
};

// ---------------------------------------------------------------------------
// Root
// ---------------------------------------------------------------------------

export type ThreadRootProps = PrimitiveProps<"div"> & {
  children?: ReactNode;
  autoScroll?: ThreadAutoScrollMode;
};

const ThreadRoot = ({
  autoScroll = "follow",
  className,
  render,
  style,
  ...elementProps
}: ThreadRootProps) => {
  const rootRef = useThreadInsets();
  const scroll = useThreadScroll(autoScroll);

  const element = useRenderElement(
    "div",
    { className, render, style },
    {
      ref: rootRef,
      props: [
        {
          "data-slot": "thread-root",
          // Anchors the overlays/composer and bounds the inset measurement.
          style: { position: "relative", overflow: "hidden" },
        },
        elementProps,
      ],
    },
  );

  return <ThreadContext value={scroll}>{element}</ThreadContext>;
};

// ---------------------------------------------------------------------------
// Overlay — a positioned marker strip; the styled layer supplies the blur/fade
// content as children. data-slot="thread-overlay-top" doubles as the top-inset
// measurement target.
// ---------------------------------------------------------------------------

export type ThreadOverlayState = {
  /** Which edge this overlay marks, surfaced as data-thread-overlay. */
  direction: "top" | "bottom";
};

const threadOverlayStateMapping: StateAttributesMapping<ThreadOverlayState> = {
  direction: (value): Record<string, string> => ({ "data-thread-overlay": value }),
};

export type ThreadOverlayProps = PrimitiveProps<"div", ThreadOverlayState> & {
  direction: "top" | "bottom";
};

const ThreadOverlay = memo(
  ({ direction, className, render, style, ...elementProps }: ThreadOverlayProps) =>
    useRenderElement(
      "div",
      { className, render, style },
      {
        state: { direction },
        stateAttributesMapping: threadOverlayStateMapping,
        props: [
          {
            "data-slot": `thread-overlay-${direction}`,
            // A sibling of the scroll container: never swallow wheel/drag/click.
            style: { position: "absolute", pointerEvents: "none" },
          },
          elementProps,
        ],
      },
    ),
);

ThreadOverlay.displayName = "ThreadOverlay";

// ---------------------------------------------------------------------------
// Viewport — the scroll container. A focusable region so keyboard users can
// scroll the transcript; wheel/touch/scroll-key gestures double as the
// deliberate reading intent that releases the follow.
// ---------------------------------------------------------------------------

export type ThreadViewportProps = PrimitiveProps<"div">;

const ThreadViewport = ({ className, render, style, ...elementProps }: ThreadViewportProps) => {
  const { scrollRef, releaseFollow } = useThreadContext();

  const handleKeyDown = useCallback(
    (event: KeyboardEvent<HTMLDivElement>) => {
      if (USER_SCROLL_KEYS.has(event.key)) releaseFollow();
    },
    [releaseFollow],
  );

  return useRenderElement(
    "div",
    { className, render, style },
    {
      ref: scrollRef,
      props: [
        {
          "data-slot": "thread-scroller",
          role: "region",
          "aria-label": "Messages",
          tabIndex: 0,
          style: { overflowY: "auto", overflowX: "hidden" },
          onWheel: releaseFollow,
          onTouchMove: releaseFollow,
          onKeyDown: handleKeyDown,
        },
        elementProps,
      ],
    },
  );
};

// ---------------------------------------------------------------------------
// Content — the measured content column plus the at-bottom sentinel rendered
// as its sibling (outside the last-child reserve).
// ---------------------------------------------------------------------------

export type ThreadContentProps = PrimitiveProps<"div">;

const ThreadContent = ({ className, render, style, ...elementProps }: ThreadContentProps) => {
  const { contentRef, sentinelRef } = useThreadContext();

  const element = useRenderElement(
    "div",
    { className, render, style },
    {
      ref: contentRef,
      props: [
        {
          "data-slot": "thread-content",
          // The transcript is the live log; new turns are what screen readers
          // should announce.
          role: "log",
          "aria-relevant": "additions" as const,
        },
        elementProps,
      ],
    },
  );

  return (
    <>
      {element}
      <div
        ref={sentinelRef}
        data-slot="thread-bottom"
        aria-hidden
        style={{ height: 1, width: "100%", flexShrink: 0 }}
      />
    </>
  );
};

// ---------------------------------------------------------------------------
// Composer slot + Placeholder — structural markers.
// ---------------------------------------------------------------------------

export type ThreadComposerProps = PrimitiveProps<"div">;

const ThreadComposer = ({ className, render, style, ...elementProps }: ThreadComposerProps) =>
  useRenderElement(
    "div",
    { className, render, style },
    { props: [{ "data-slot": "thread-composer" }, elementProps] },
  );

export type ThreadPlaceholderProps = PrimitiveProps<"div">;

const ThreadPlaceholder = ({ className, render, style, ...elementProps }: ThreadPlaceholderProps) =>
  useRenderElement(
    "div",
    { className, render, style },
    { props: [{ "data-slot": "thread-placeholder" }, elementProps] },
  );

// ---------------------------------------------------------------------------
// Compound export
// ---------------------------------------------------------------------------

export const Thread = Object.assign(ThreadRoot, {
  Overlay: ThreadOverlay,
  Viewport: ThreadViewport,
  Content: ThreadContent,
  Composer: ThreadComposer,
  Placeholder: ThreadPlaceholder,
});
