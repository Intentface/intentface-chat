"use client";

import { AnimatePresence, motion } from "motion/react";
import type { ComponentProps, ReactNode, RefObject } from "react";
import {
  createContext,
  memo,
  use,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { IconButton } from "@/components/ui/icon-button";
import { ProgressiveBlur } from "@/components/ui/progressive-blur";
import { cn } from "@/lib/utils";
import { ArrowDownIcon } from "../icons/arrow-down";

// ---------------------------------------------------------------------------
// Scroll context (replaces use-stick-to-bottom)
// ---------------------------------------------------------------------------

type ThreadScrollContextValue = {
  isAtBottom: boolean;
  scrollToBottom: (behavior?: ScrollBehavior) => void;
  scrollRef: RefObject<HTMLDivElement | null>;
};

const ThreadScrollContext = createContext<ThreadScrollContextValue | null>(null);

export const useThreadScroll = () => {
  const ctx = use(ThreadScrollContext);
  if (!ctx) throw new Error("useThreadScroll must be used within <Thread>");
  return ctx;
};

// Single place that performs the scroll, so callers just choose the behavior:
// 'instant' for jumps that must not animate (first mount), 'smooth' for
// deliberate movements.
const scrollContainerTo = (el: HTMLElement, top: number, behavior: ScrollBehavior) => {
  el.scrollTo({ top, behavior });
};

// ---------------------------------------------------------------------------
// ThreadRoot
// ---------------------------------------------------------------------------

export type ThreadRootProps = ComponentProps<"div"> & {
  children?: ReactNode;
};

// Fallback (px) until the composer is measured; matches the 8rem class default.
const DEFAULT_BOTTOM_OFFSET = 128;
// Breathing room between the last line of content and the composer dock. The
// bottom blur overlay spans it, so this doubles as the visible progressive-blur
// band that peeks above the composer.
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
  const dock =
    root.querySelector('[data-slot="composer-context-window"]') ??
    root.querySelector('[data-slot="composer-container"]');
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
 *   --thread-turn-min-height is the visible thread area (root − top − bottom),
 *   which the last turn uses as its min-height to pin itself to the top.
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
      const turnMin = Math.max(
        0,
        Math.round(root.clientHeight - topInset - (bottomInset ?? DEFAULT_BOTTOM_OFFSET)),
      );
      root.style.setProperty("--thread-turn-min-height", `${turnMin}px`);
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

const ThreadRoot = ({ children, className, ...props }: ThreadRootProps) => {
  const rootRef = useThreadInsets();
  const scrollRef = useRef<HTMLDivElement>(null);
  const [isAtBottom, setIsAtBottom] = useState(true);
  // Fresh mirror for the ResizeObserver below — it reads the latest value
  // without re-subscribing (re-subscribing re-fires observe() and thrashes).
  const isAtBottomRef = useRef(true);

  const scrollToBottom = useCallback((behavior: ScrollBehavior = "smooth") => {
    const el = scrollRef.current;
    if (el) scrollContainerTo(el, el.scrollHeight, behavior);
  }, []);

  // First mount: jump straight to the bottom so an existing conversation opens
  // pinned to the latest message instead of flashing at the top. Declared after
  // useThreadInsets, so --thread-turn-min-height is already written and the last
  // turn's reserved height is included in scrollHeight.
  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (el) scrollContainerTo(el, el.scrollHeight, "instant");
  }, []);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;

    const check = () => {
      // Pure scroll math — the button must stay reachable even while the last
      // turn's min-height still has room, so the user can scroll up during a
      // long streaming response.
      const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 50;
      isAtBottomRef.current = atBottom;
      setIsAtBottom(atBottom);
    };

    let rafId: number;
    const onScroll = () => {
      cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(check);
    };

    el.addEventListener("scroll", onScroll, { passive: true });

    // Follow the stream: when content grows while we're pinned to the bottom,
    // keep the bottom in view. The last turn's min-height shapes where "bottom"
    // is, so this holds a new turn pinned to the top until its response
    // overflows the viewport, then trails the stream (smooth — see 42b4e18).
    // When detached, just re-evaluate so the button hides if a shrink (e.g. a
    // collapsing reasoning block) leaves us back at the bottom.
    const onContentResize = () => {
      if (isAtBottomRef.current) scrollContainerTo(el, el.scrollHeight, "smooth");
      else check();
    };
    const observer = new ResizeObserver(onContentResize);
    if (el.firstElementChild) observer.observe(el.firstElementChild);

    return () => {
      el.removeEventListener("scroll", onScroll);
      cancelAnimationFrame(rafId);
      observer.disconnect();
    };
  }, []);

  return (
    <ThreadScrollContext value={{ isAtBottom, scrollToBottom, scrollRef }}>
      <div
        ref={rootRef}
        data-slot="thread-root"
        className={cn(
          "relative flex h-full w-full overflow-hidden [--thread-overlay-top-height:4rem] [--thread-overlay-bottom-height:8rem]",
          className,
        )}
        role="log"
        {...props}
      >
        {children}
      </div>
    </ThreadScrollContext>
  );
};

// ---------------------------------------------------------------------------
// ThreadOverlay
// ---------------------------------------------------------------------------

export type ThreadOverlayProps = ComponentProps<typeof ProgressiveBlur> & {
  direction: "top" | "bottom";
};

const ThreadOverlay = memo(({ className, direction, ...props }: ThreadOverlayProps) => (
  <div
    data-slot={`thread-overlay-${direction}`}
    data-thread-overlay={direction}
    className={cn(
      // pointer-events-none: the overlay is a sibling of the scroll
      // container, so without this it would swallow wheel/drag/click events
      // over its strip instead of letting them through to the content.
      "group/thread-overlay pointer-events-none absolute right-0 left-0 z-1 mx-auto w-full max-w-(--thread-width)",
      'data-[thread-overlay="top"]:h-(--thread-overlay-top-height) data-[thread-overlay="top"]:top-0',
      'data-[thread-overlay="bottom"]:h-(--thread-overlay-bottom-height) data-[thread-overlay="bottom"]:bottom-0',

      className,
    )}
  >
    <ProgressiveBlur
      direction={direction}
      className={cn(
        "h-full w-full bg-linear-to-b from-secondary to-transparent",
        "group-data-[thread-overlay='top']/thread-overlay:bg-linear-to-b",
        "group-data-[thread-overlay='bottom']/thread-overlay:bg-linear-to-t",
      )}
      {...props}
    />
  </div>
));

ThreadOverlay.displayName = "ThreadOverlay";

// ---------------------------------------------------------------------------
// ThreadViewport
// ---------------------------------------------------------------------------

export type ThreadViewportProps = ComponentProps<"div"> & {
  children?: ReactNode;
};

const ThreadViewport = ({ children, className, ...props }: ThreadViewportProps) => {
  const { scrollRef } = useThreadScroll();

  return (
    <div
      ref={scrollRef}
      className="h-full w-full overflow-y-auto overflow-x-hidden [scrollbar-gutter:stable] [scrollbar-width:thin] [scrollbar-color:var(--color-ink-tertiary)_transparent]"
    >
      <div
        data-slot="thread-viewport"
        className={cn(
          "relative @container/thread-viewport flex w-full min-w-[340px] flex-col items-center",
          "min-h-full",
          "has-data-[slot=thread-placeholder]:h-full",
          className,
        )}
        {...props}
      >
        <div className="relative flex min-h-full w-full flex-col items-center pt-(--thread-overlay-top-height) pb-(--thread-overlay-bottom-height)">
          <div
            className={cn(
              "mx-auto px-4 flex min-h-full w-full max-w-(--thread-width) flex-col gap-4",
            )}
          >
            {children}
          </div>
        </div>
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------------
// ThreadComposer
// ---------------------------------------------------------------------------

export type ThreadComposerProps = ComponentProps<"div"> & {
  children?: ReactNode;
};

const ThreadComposer = ({ className, children, ...props }: ThreadComposerProps) => (
  <div
    data-slot="thread-composer"
    className={cn(
      "absolute inset-x-0 bottom-0 mx-auto w-full z-2 max-w-(--thread-width)",
      className,
    )}
    {...props}
  >
    <div className="relative flex w-full flex-col items-center px-4 pb-4 @lg/thread-viewport:px-0">
      {children}
    </div>
  </div>
);

// ---------------------------------------------------------------------------
// ThreadScrollButton (arrow to scroll to bottom — no auto-stick)
// ---------------------------------------------------------------------------

export type ThreadScrollButtonProps = ComponentProps<typeof motion.div>;

const ThreadScrollButton = ({ className, ...props }: ThreadScrollButtonProps) => {
  const { isAtBottom, scrollToBottom } = useThreadScroll();

  const handleScrollToBottom = useCallback(() => {
    scrollToBottom();
  }, [scrollToBottom]);

  return (
    <div className="absolute -top-3 right-4 mx-auto flex h-0 w-full justify-center px-4 md:px-0">
      <div className="z-2 flex h-0 w-full max-w-(--thread-width) items-end justify-end">
        <AnimatePresence>
          {!isAtBottom && (
            <motion.div
              aria-label="Scroll to bottom"
              initial={{ opacity: 0, y: 8, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 8, scale: 0.9 }}
              transition={{ duration: 0.2, ease: "easeOut" }}
              {...props}
            >
              <IconButton size="lg" onClick={handleScrollToBottom} className="rounded-full">
                <ArrowDownIcon />
              </IconButton>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------------
// ThreadPlaceholder
// ---------------------------------------------------------------------------

export type ThreadEmptyStateProps = ComponentProps<"div"> & {
  title?: string;
  description?: string;
  icon?: React.ReactNode;
};

export type ThreadPlaceholderProps = ComponentProps<"div">;

const ThreadPlaceholder = ({ children, className, ...props }: ThreadPlaceholderProps) => (
  <div
    data-slot="thread-placeholder"
    className={cn("flex flex-1 flex-col items-center justify-center gap-4", className)}
    {...props}
  >
    {children}
  </div>
);

// ---------------------------------------------------------------------------
// Compound export
// ---------------------------------------------------------------------------

export const Thread = Object.assign(ThreadRoot, {
  Overlay: ThreadOverlay,
  Viewport: ThreadViewport,
  Composer: ThreadComposer,
  Placeholder: ThreadPlaceholder,
  ScrollButton: ThreadScrollButton,
});
