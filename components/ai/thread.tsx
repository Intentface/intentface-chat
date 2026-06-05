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
import Button from "@/components/ui/button";
import { ProgressiveBlur } from "@/components/ui/progressive-blur";
import { cn } from "@/lib/utils";
import { ArrowDownIcon } from "../icons/arrow-down";

// ---------------------------------------------------------------------------
// Scroll context — a small, generic primitive surface. Auto-scroll behavior is
// opt-in via <Thread.AutoScroll>; nothing here knows about chats or messages.
// ---------------------------------------------------------------------------

type ThreadScrollContextValue = {
  isAtBottom: boolean;
  scrollToBottom: (behavior?: ScrollBehavior) => void;
  scrollRef: RefObject<HTMLDivElement | null>;
  contentRef: RefObject<HTMLDivElement | null>;
  sentinelRef: RefObject<HTMLDivElement | null>;
};

const ThreadScrollContext = createContext<ThreadScrollContextValue | null>(null);

export const useThreadScroll = () => {
  const ctx = use(ThreadScrollContext);
  if (!ctx) throw new Error("useThreadScroll must be used within <Thread>");
  return ctx;
};

// Single place that performs the scroll, so callers just choose the behavior:
// 'instant' for jumps that must not animate, 'smooth' for deliberate movements.
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
 *   which the last message turn uses to reserve the active area.
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
  const contentRef = useRef<HTMLDivElement>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);
  // "At the bottom" = the bottom sentinel is in view. IntersectionObserver
  // computes it off the main thread (no scrollTop/scrollHeight reads); it drives
  // the scroll button and, when <Thread.AutoScroll> is mounted, gates the follow.
  const [isAtBottom, setIsAtBottom] = useState(true);

  useEffect(() => {
    const root = scrollRef.current;
    const sentinel = sentinelRef.current;
    if (!root || !sentinel) return;
    const io = new IntersectionObserver(([entry]) => setIsAtBottom(entry.isIntersecting), { root });
    io.observe(sentinel);
    return () => io.disconnect();
  }, []);

  const scrollToBottom = useCallback((behavior: ScrollBehavior = "smooth") => {
    const el = scrollRef.current;
    if (el) scrollContainerTo(el, el.scrollHeight, behavior);
  }, []);

  return (
    <ThreadScrollContext value={{ isAtBottom, scrollToBottom, scrollRef, contentRef, sentinelRef }}>
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
        "h-full w-full bg-linear-to-b from-secondary to-transparent pointer-events-none",
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
  const { scrollRef, contentRef, sentinelRef } = useThreadScroll();

  return (
    <div
      ref={scrollRef}
      className="h-full w-full overflow-y-auto overflow-x-hidden [overflow-anchor:auto] [scrollbar-gutter:stable] [scrollbar-width:thin] [scrollbar-color:var(--color-ink-tertiary)_transparent]"
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
          {/* Content column — turns are its direct children, so the auto-scroll
              reserve can target the last turn with a clean :last-child selector. */}
          <div
            ref={contentRef}
            data-slot="thread-content"
            className="mx-auto px-4 flex min-h-full w-full max-w-(--thread-width) flex-col gap-4"
          >
            {children}
          </div>
          {/* Bottom sentinel — sibling of the content (not a child), so it stays
              out of the :last-child reserve. The IntersectionObserver watches it
              for at-bottom. */}
          <div
            ref={sentinelRef}
            data-slot="thread-bottom"
            aria-hidden
            className="h-px w-full shrink-0"
          />
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
    <div className="absolute inset-x-0 -top-3 mx-auto flex h-0 w-full justify-center px-4 md:px-0">
      <div className="z-2 flex h-0 w-full max-w-(--thread-width) items-end justify-center">
        <AnimatePresence>
          {!isAtBottom && (
            <motion.div
              initial={{ opacity: 0, y: 8, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 8, scale: 0.9 }}
              transition={{ duration: 0.2, ease: "easeOut" }}
              {...props}
            >
              <Button
                variant="secondary"
                size="sm"
                onClick={handleScrollToBottom}
                className="rounded-full shadow-md"
              >
                <ArrowDownIcon />
                Latest
              </Button>
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
// ThreadAutoScroll — opt-in. Mount it to land on the latest turn and follow
// streaming content while the user stays at the bottom.
// Renders nothing; it reacts to its own DOM (no chatId, no messages, no key).
// ---------------------------------------------------------------------------

const ThreadAutoScroll = () => {
  const { contentRef, isAtBottom, scrollToBottom } = useThreadScroll();
  // Mirror at-bottom into a ref so the follow observer reads it without
  // re-subscribing each time it flips.
  const atBottomRef = useRef(isAtBottom);
  atBottomRef.current = isAtBottom;

  useEffect(() => {
    const content = contentRef.current;
    if (!content) return;

    let hasLanded = false;
    let ignoreNextResize = true;

    const landOnLatest = (behavior: ScrollBehavior) => {
      ignoreNextResize = true;
      scrollToBottom(behavior);
      hasLanded = true;
    };

    const handleContentMutation = (records: MutationRecord[]) => {
      const replacedContent = records.some((record) => record.removedNodes.length > 0);
      landOnLatest(hasLanded && !replacedContent ? "smooth" : "instant");
    };

    const followLatest = () => {
      if (ignoreNextResize) {
        ignoreNextResize = false;
        return;
      }
      if (!atBottomRef.current) return;
      scrollToBottom("smooth");
    };

    landOnLatest("instant");

    const mo = new MutationObserver(handleContentMutation);
    mo.observe(content, { childList: true });

    // Follow streaming growth only while the user remains at the bottom.
    const ro = new ResizeObserver(followLatest);
    ro.observe(content);

    return () => {
      mo.disconnect();
      ro.disconnect();
    };
  }, [contentRef, scrollToBottom]);

  return null;
};

// ---------------------------------------------------------------------------
// Compound export
// ---------------------------------------------------------------------------

export const Thread = Object.assign(ThreadRoot, {
  Overlay: ThreadOverlay,
  Viewport: ThreadViewport,
  Composer: ThreadComposer,
  Placeholder: ThreadPlaceholder,
  ScrollButton: ThreadScrollButton,
  AutoScroll: ThreadAutoScroll,
});
