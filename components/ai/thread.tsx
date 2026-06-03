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

const useThreadScroll = () => {
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

/**
 * Writes the measured composer inset straight to --thread-overlay-bottom-height
 * on the root (driving the bottom overlay + viewport padding) via a
 * ResizeObserver — no React state, so composer growth never re-renders the
 * thread. The spacer reads the same measurement for its own height.
 */
const useComposerDockOffset = () => {
  const rootRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    const apply = () => {
      const inset = measureComposerInset(root);
      if (inset !== null) {
        root.style.setProperty("--thread-overlay-bottom-height", `${inset}px`);
      }
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
  const rootRef = useComposerDockOffset();
  const scrollRef = useRef<HTMLDivElement>(null);
  const [isAtBottom, setIsAtBottom] = useState(true);

  const scrollToBottom = useCallback((behavior: ScrollBehavior = "smooth") => {
    const el = scrollRef.current;
    if (el) scrollContainerTo(el, el.scrollHeight, behavior);
  }, []);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;

    const check = () => {
      // Honor pure scroll math. Short-circuiting to true while the spacer
      // still has room would keep the button hidden during long streaming
      // messages (the user message stays pinned via the spacer, but the
      // assistant content below it can already overflow the viewport — and
      // the user wants to be able to scroll up).
      const threshold = 50;
      setIsAtBottom(el.scrollHeight - el.scrollTop - el.clientHeight < threshold);
    };

    let rafId: number;
    const onScroll = () => {
      cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(check);
    };

    el.addEventListener("scroll", onScroll, { passive: true });

    // Also check when content resizes (new messages, spacer height changes)
    const observer = new ResizeObserver(check);
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
// DynamicSpacer
// ---------------------------------------------------------------------------

const getScrollParent = (element: HTMLElement): HTMLElement | null => {
  let parent = element.parentElement;
  while (parent) {
    const { overflowY } = getComputedStyle(parent);
    if (overflowY === "auto" || overflowY === "scroll") return parent;
    parent = parent.parentElement;
  }
  return null;
};

// Top inset reserved by the top overlay, measured straight off the rendered
// element (px) — no getComputedStyle / rem→px conversion. 0 if no top overlay.
const measureTopInset = (root: HTMLElement): number =>
  root.querySelector('[data-slot="thread-overlay-top"]')?.getBoundingClientRect().height ?? 0;

// Distance from `target`'s row down to the spacer (px). They're siblings, so the
// offsetTop delta already includes the flex gaps between them — no gap lookup,
// no per-child loop, no getComputedStyle.
const measureContentHeight = (spacer: HTMLElement, target: HTMLElement): number => {
  const parent = spacer.parentElement;
  if (!parent) return 0;
  const children = Array.from(parent.children) as HTMLElement[];
  const targetChild = children.find((child) => child.contains(target)) ?? target;
  return spacer.offsetTop - targetChild.offsetTop;
};

// Scroll offset of `el`'s top within `container`'s scrollable content.
const absoluteTop = (container: HTMLElement, el: HTMLElement): number =>
  container.scrollTop + el.getBoundingClientRect().top - container.getBoundingClientRect().top;

const ThreadSpacer = () => {
  const { isAtBottom } = useThreadScroll();
  const spacerRef = useRef<HTMLDivElement>(null);
  const scrollParentRef = useRef<HTMLElement | null>(null);
  const prevUserMessageCountRef = useRef(0);
  const hasInitializedRef = useRef(false);

  const calculateHeight = useCallback(() => {
    const spacer = spacerRef.current;
    if (!spacer) return;

    scrollParentRef.current ??= getScrollParent(spacer);
    const scrollContainer = scrollParentRef.current;
    if (!scrollContainer) return;

    const userMessages = scrollContainer.querySelectorAll<HTMLElement>(
      '[data-slot="message"][data-role="user"]',
    );
    const messages = scrollContainer.querySelectorAll<HTMLElement>('[data-slot="message"]');
    const target = userMessages[userMessages.length - 1] ?? null;
    if (!target) return;

    const threadRoot = scrollContainer.closest<HTMLElement>('[data-slot="thread-root"]');
    const rootHeight = threadRoot?.clientHeight ?? scrollContainer.clientHeight;
    const topInset = threadRoot ? measureTopInset(threadRoot) : 0;
    const bottomInset = (threadRoot && measureComposerInset(threadRoot)) ?? DEFAULT_BOTTOM_OFFSET;

    const remaining = rootHeight - topInset - bottomInset - measureContentHeight(spacer, target);
    spacer.style.height = `${Math.max(0, remaining)}px`;

    if (!hasInitializedRef.current && messages.length > 0) {
      // First mount with content: jump instantly so we don't flash at the top.
      scrollContainerTo(scrollContainer, scrollContainer.scrollHeight, "instant");
    } else if (userMessages.length > prevUserMessageCountRef.current) {
      // New user message: pin it just below the top overlay. absoluteTop() forces
      // a reflow, so this scrolls against the freshly-applied spacer height.
      const top =
        remaining <= 0
          ? scrollContainer.scrollHeight
          : Math.max(0, absoluteTop(scrollContainer, target) - topInset);
      scrollContainerTo(scrollContainer, top, "smooth");
    } else if (remaining <= 0 && isAtBottom) {
      // Follow the stream once content overflows and the user is at the bottom.
      // Smooth is deliberate here (see 42b4e18) — loredex uses instant instead.
      scrollContainerTo(scrollContainer, scrollContainer.scrollHeight, "smooth");
    }

    prevUserMessageCountRef.current = userMessages.length;
    if (messages.length > 0) hasInitializedRef.current = true;
  }, [isAtBottom]);

  // Live ref so the dock observer can call the latest calculateHeight without
  // re-subscribing — re-subscribing a ResizeObserver re-fires it on observe(),
  // which combined with the isAtBottom feedback caused a measure storm.
  const calculateHeightRef = useRef(calculateHeight);
  calculateHeightRef.current = calculateHeight;

  // Recalculate before paint
  useLayoutEffect(() => {
    calculateHeight();
  });

  // Recompute when the thread root (window resize) or the composer dock (context
  // window, attachments) changes size. ThreadRoot's hook writes the CSS var for
  // the overlay + padding; this keeps the spacer's imperative height in sync
  // without a re-render. Subscribe once and call through the ref — re-subscribing
  // would re-fire the observer on each observe() and thrash.
  useLayoutEffect(() => {
    const threadRoot = spacerRef.current?.closest<HTMLElement>('[data-slot="thread-root"]');
    if (!threadRoot) return;
    const observer = new ResizeObserver(() => calculateHeightRef.current());
    observer.observe(threadRoot);
    for (const part of threadRoot.querySelectorAll(DOCK_SELECTOR)) {
      observer.observe(part);
    }
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={spacerRef}
      data-slot="thread-spacer"
      className="w-full shrink-0 ease-out"
      style={{ overflowAnchor: "none" }}
    />
  );
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
  Spacer: ThreadSpacer,
});
