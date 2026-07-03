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
  type ComponentProps,
  createContext,
  memo,
  type ReactNode,
  type RefObject,
  use,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";

// ---------------------------------------------------------------------------
// Thread context — a small, generic primitive surface. Auto-scroll behavior is
// driven by the <Thread autoScroll> prop; nothing here knows about chats or messages.
// ---------------------------------------------------------------------------

type ThreadContextValue = {
  isAtBottom: boolean;
  scrollToBottom: (behavior?: ScrollBehavior) => void;
  scrollRef: RefObject<HTMLDivElement | null>;
  contentRef: RefObject<HTMLDivElement | null>;
  sentinelRef: RefObject<HTMLDivElement | null>;
};

const ThreadContext = createContext<ThreadContextValue | null>(null);

export const useThread = () => {
  const ctx = use(ThreadContext);
  if (!ctx) throw new Error("useThread must be used within <Thread>");
  return ctx;
};

// Single place that performs the scroll, so callers just choose the behavior:
// 'instant' for jumps that must not animate, 'smooth' for deliberate movements.
const scrollContainerTo = (el: HTMLElement, top: number, behavior: ScrollBehavior) => {
  el.scrollTo({ top, behavior });
};

// ---------------------------------------------------------------------------
// useThreadScroll — owns the thread's scroll subsystem: the scroll/content/
// sentinel refs, at-bottom detection, scrollToBottom, and the autoScroll
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
// ---------------------------------------------------------------------------

export type ThreadAutoScrollMode = "off" | "bottom" | "jump" | "follow";

const useThreadScroll = (mode: ThreadAutoScrollMode): ThreadContextValue => {
  const scrollRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);
  // "At the bottom" = the bottom sentinel is in view. IntersectionObserver
  // computes it off the main thread (no scrollTop/scrollHeight reads); it drives
  // the scroll button and, when autoScroll is active, gates the follow.
  const [isAtBottom, setIsAtBottom] = useState(true);

  useEffect(() => {
    const root = scrollRef.current;
    const sentinel = sentinelRef.current;
    if (!root || !sentinel) return;
    const io = new IntersectionObserver(([entry]) => setIsAtBottom(entry?.isIntersecting ?? true), {
      root,
    });
    io.observe(sentinel);
    return () => io.disconnect();
  }, []);

  const scrollToBottom = useCallback((behavior: ScrollBehavior = "smooth") => {
    const el = scrollRef.current;
    if (el) scrollContainerTo(el, el.scrollHeight, behavior);
  }, []);

  // Mirror at-bottom into a ref so the follow observer reads it without
  // re-subscribing each time it flips.
  const atBottomRef = useRef(isAtBottom);
  atBottomRef.current = isAtBottom;

  useLayoutEffect(() => {
    const content = contentRef.current;
    if (!content || mode === "off") return;

    const landsAtTop = mode !== "bottom";
    const followsStream = mode !== "jump";

    // Reserve a viewport on the last turn so the newest lands at the top.
    if (landsAtTop) {
      content.style.setProperty("--thread-turn-min-height", "var(--thread-turn-area)");
    }

    // First land (and chat switches) jump instantly; later turns animate.
    let landed = false;
    let skipNextResize = true;
    const land = (mutations: MutationRecord[] = []) => {
      const replaced = mutations.some((m) => m.removedNodes.length > 0);
      skipNextResize = true;
      scrollToBottom(landed && !replaced ? "smooth" : "instant");
      landed = true;
    };

    // Follow streaming growth, but skip the resize our own land just caused and
    // yield the moment the user scrolls up.
    const follow = () => {
      if (skipNextResize) {
        skipNextResize = false;
        return;
      }
      if (atBottomRef.current) scrollToBottom("smooth");
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
  }, [mode, scrollToBottom]);

  return { isAtBottom, scrollToBottom, scrollRef, contentRef, sentinelRef };
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

export type ThreadRootProps = ComponentProps<"div"> & {
  children?: ReactNode;
  autoScroll?: ThreadAutoScrollMode;
};

const ThreadRoot = ({ children, autoScroll = "follow", style, ...props }: ThreadRootProps) => {
  const rootRef = useThreadInsets();
  const scroll = useThreadScroll(autoScroll);

  return (
    <ThreadContext value={scroll}>
      <div
        ref={rootRef}
        data-slot="thread-root"
        role="log"
        // Anchors the overlays/composer and bounds the inset measurement.
        style={{ position: "relative", overflow: "hidden", ...style }}
        {...props}
      >
        {children}
      </div>
    </ThreadContext>
  );
};

// ---------------------------------------------------------------------------
// Overlay — a positioned marker strip; the styled layer supplies the blur/fade
// content as children. data-slot="thread-overlay-top" doubles as the top-inset
// measurement target.
// ---------------------------------------------------------------------------

export type ThreadOverlayProps = ComponentProps<"div"> & {
  direction: "top" | "bottom";
};

const ThreadOverlay = memo(({ direction, style, ...props }: ThreadOverlayProps) => (
  <div
    data-slot={`thread-overlay-${direction}`}
    data-thread-overlay={direction}
    // A sibling of the scroll container: never swallow wheel/drag/click.
    style={{ position: "absolute", pointerEvents: "none", ...style }}
    {...props}
  />
));

ThreadOverlay.displayName = "ThreadOverlay";

// ---------------------------------------------------------------------------
// Viewport — the scroll container.
// ---------------------------------------------------------------------------

export type ThreadViewportProps = ComponentProps<"div">;

const ThreadViewport = ({ children, style, ...props }: ThreadViewportProps) => {
  const { scrollRef } = useThread();

  return (
    <div
      ref={scrollRef}
      data-slot="thread-scroller"
      style={{ overflowY: "auto", overflowX: "hidden", ...style }}
      {...props}
    >
      {children}
    </div>
  );
};

// ---------------------------------------------------------------------------
// Content — the measured content column plus the at-bottom sentinel rendered
// as its sibling (outside the last-child reserve).
// ---------------------------------------------------------------------------

export type ThreadContentProps = ComponentProps<"div">;

const ThreadContent = ({ children, ...props }: ThreadContentProps) => {
  const { contentRef, sentinelRef } = useThread();

  return (
    <>
      <div ref={contentRef} data-slot="thread-content" {...props}>
        {children}
      </div>
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

export type ThreadComposerProps = ComponentProps<"div">;

const ThreadComposer = (props: ThreadComposerProps) => (
  <div data-slot="thread-composer" {...props} />
);

export type ThreadPlaceholderProps = ComponentProps<"div">;

const ThreadPlaceholder = (props: ThreadPlaceholderProps) => (
  <div data-slot="thread-placeholder" {...props} />
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
