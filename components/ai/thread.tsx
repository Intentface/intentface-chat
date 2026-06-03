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
  scrollToBottom: () => void;
  scrollRef: RefObject<HTMLDivElement | null>;
};

const ThreadScrollContext = createContext<ThreadScrollContextValue | null>(null);

const useThreadScroll = () => {
  const ctx = use(ThreadScrollContext);
  if (!ctx) throw new Error("useThreadScroll must be used within <Thread>");
  return ctx;
};

// ---------------------------------------------------------------------------
// ThreadRoot
// ---------------------------------------------------------------------------

export type ThreadRootProps = ComponentProps<"div"> & {
  children?: ReactNode;
};

const ThreadRoot = ({ children, className, ...props }: ThreadRootProps) => {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [isAtBottom, setIsAtBottom] = useState(true);

  const scrollToBottom = useCallback(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, []);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;

    const check = () => {
      // If the spacer still has room it's absorbing AI growth — the
      // latest content is by definition visible, so the scroll-to-bottom
      // button must stay hidden regardless of mid-flight scrollTop
      // (e.g., during the submit smooth-scroll animation). Only once the
      // spacer collapses do we consult raw scroll math.
      // const spacer = el.querySelector<HTMLElement>(
      //   '[data-slot="thread-spacer"]',
      // );
      // if (spacer && spacer.offsetHeight > 0) {
      //   setIsAtBottom(true);
      //   return;
      // }
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
      "group/thread-overlay absolute right-0 left-0 z-1 mx-auto w-full max-w-(--thread-width)",
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
      className="h-full w-full overflow-y-auto overflow-x-hidden [scrollbar-gutter:stable]"
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

type DynamicSpacerProps = {
  /** Explicit ref to the element to keep at the top. Defaults to the last user message. */
  targetRef?: RefObject<HTMLElement | null>;
  /** Offset from the top of the visible area in px. Defaults to 0. */
  topOffset?: number;
  /** Minimum spacer height in px. Defaults to 0. */
  minHeight?: number;
};

const ThreadSpacer = ({ targetRef, topOffset, minHeight }: DynamicSpacerProps) => {
  const { isAtBottom } = useThreadScroll();
  const spacerRef = useRef<HTMLDivElement>(null);
  const scrollParentRef = useRef<HTMLElement | null>(null);
  const prevUserMessageCountRef = useRef(0);
  const hasInitializedRef = useRef(false);
  const pendingScrollRef = useRef<number | null>(null);
  // Cache overlay heights — only recomputed on resize
  const overlayCache = useRef<{
    topOffset: number;
    bottomOffset: number;
  } | null>(null);

  const resolveOverlays = useCallback(
    (threadRoot: HTMLElement | null) => {
      if (overlayCache.current) return overlayCache.current;
      const remSize = Number.parseFloat(getComputedStyle(document.documentElement).fontSize);
      const rootStyles = threadRoot ? getComputedStyle(threadRoot) : null;
      const top = rootStyles
        ? Number.parseFloat(rootStyles.getPropertyValue("--thread-overlay-top-height")) * remSize
        : 0;
      const bottom = rootStyles
        ? Number.parseFloat(rootStyles.getPropertyValue("--thread-overlay-bottom-height")) * remSize
        : 0;
      overlayCache.current = {
        topOffset: topOffset ?? top,
        bottomOffset: bottom,
      };
      return overlayCache.current;
    },
    [topOffset],
  );

  const calculateHeight = useCallback(() => {
    if (!spacerRef.current) return;

    if (!scrollParentRef.current) {
      scrollParentRef.current = getScrollParent(spacerRef.current);
    }
    const scrollContainer = scrollParentRef.current;
    if (!scrollContainer) return;

    const userMessages = scrollContainer.querySelectorAll<HTMLElement>(
      '[data-slot="message"][data-role="user"]',
    );
    const messages = scrollContainer.querySelectorAll<HTMLElement>('[data-slot="message"]');
    const target = targetRef?.current ?? userMessages[userMessages.length - 1] ?? null;
    if (!target) return;

    const threadRoot = scrollContainer.closest<HTMLElement>('[data-slot="thread-root"]');
    const rootHeight = threadRoot?.clientHeight ?? scrollContainer.clientHeight;
    const overlays = resolveOverlays(threadRoot);
    const effectiveMinHeight = minHeight ?? 0;

    // Measure actual content height: sum heights of siblings from target to spacer
    const parent = spacerRef.current.parentElement;
    let contentHeight = 0;
    if (parent) {
      const children = Array.from(parent.children) as HTMLElement[];
      const spacerIndex = children.indexOf(spacerRef.current);
      const targetChild = children.find((child) => child.contains(target)) ?? target;
      const targetIndex = children.indexOf(targetChild);
      const gap = Number.parseFloat(getComputedStyle(parent).gap) || 0;

      for (let i = targetIndex; i >= 0 && i < spacerIndex; i++) {
        contentHeight += children[i].offsetHeight;
      }
      // Each child contributes one trailing gap (between it and the next
      // sibling, including the gap separating the last child from the spacer
      // itself). Without this, the spacer ends up one `gap` too tall and the
      // viewport overflows.
      if (gap) contentHeight += (spacerIndex - targetIndex) * gap;
    }

    const calculatedHeight =
      rootHeight - overlays.topOffset - overlays.bottomOffset - contentHeight;

    spacerRef.current.style.height = `${Math.max(effectiveMinHeight, calculatedHeight)}px`;

    // First time messages appear, jump to bottom synchronously (before paint)
    // so there's no flash at the top. Subsequent new user messages get a
    // smooth scroll, queued for after paint. Once the spacer has fully
    // collapsed (calculatedHeight ≤ 0), content overflows the viewport —
    // if the user was at the bottom, follow the stream by snapping.
    if (!hasInitializedRef.current && messages.length > 0) {
      scrollContainer.scrollTop = scrollContainer.scrollHeight;
    } else if (userMessages.length > prevUserMessageCountRef.current) {
      if (calculatedHeight <= 0) {
        pendingScrollRef.current = scrollContainer.scrollHeight;
      } else {
        const containerRect = scrollContainer.getBoundingClientRect();
        const targetRect = target.getBoundingClientRect();
        const targetAbsoluteTop = scrollContainer.scrollTop + (targetRect.top - containerRect.top);
        pendingScrollRef.current = Math.max(0, targetAbsoluteTop - overlays.topOffset);
      }
    } else if (calculatedHeight <= 0 && isAtBottom) {
      scrollContainer.scrollTo({
        top: scrollContainer.scrollHeight,
        behavior: "smooth",
      });
    }
    prevUserMessageCountRef.current = userMessages.length;
    if (messages.length > 0) hasInitializedRef.current = true;
  }, [targetRef, minHeight, resolveOverlays, isAtBottom]);

  // Recalculate before paint
  useLayoutEffect(() => {
    calculateHeight();
  });

  // Apply pending scroll after paint
  useEffect(() => {
    if (pendingScrollRef.current !== null && scrollParentRef.current) {
      scrollParentRef.current.scrollTo({
        top: pendingScrollRef.current,
        behavior: "smooth",
      });
      pendingScrollRef.current = null;
    }
  });

  useEffect(() => {
    const onResize = () => {
      overlayCache.current = null; // Invalidate on resize (rem/viewport may change)
      calculateHeight();
    };
    window.addEventListener("resize", onResize, { passive: true });
    return () => window.removeEventListener("resize", onResize);
  }, [calculateHeight]);

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
