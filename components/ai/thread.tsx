"use client";

import { AnimatePresence, motion } from "motion/react";
import type { ComponentProps, ReactNode, RefObject } from "react";
import {
  createContext,
  memo,
  use,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { DynamicSpacer } from "@/components/ai/dynamic-spacer";
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

const ThreadScrollContext = createContext<ThreadScrollContextValue | null>(
  null,
);

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
      const threshold = 50;
      setIsAtBottom(
        el.scrollHeight - el.scrollTop - el.clientHeight < threshold,
      );
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

const ThreadOverlay = memo(
  ({ className, direction, ...props }: ThreadOverlayProps) => (
    <div
      data-slot="thread-overlay-top"
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
          "h-full w-full bg-linear-to-b from-slate-2 to-transparent",
          "group-data-[thread-overlay='top']/thread-overlay:bg-linear-to-b",
          "group-data-[thread-overlay='bottom']/thread-overlay:bg-linear-to-t",
        )}
        {...props}
      />
    </div>
  ),
);

ThreadOverlay.displayName = "ThreadOverlay";

// ---------------------------------------------------------------------------
// ThreadViewport
// ---------------------------------------------------------------------------

export type ThreadViewportProps = ComponentProps<"div"> & {
  children?: ReactNode;
};

const ThreadViewport = ({
  children,
  className,
  ...props
}: ThreadViewportProps) => {
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

const ThreadComposer = ({
  className,
  children,
  ...props
}: ThreadComposerProps) => (
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

const ThreadScrollButton = ({
  className,
  ...props
}: ThreadScrollButtonProps) => {
  const { isAtBottom, scrollToBottom } = useThreadScroll();

  const handleScrollToBottom = useCallback(() => {
    scrollToBottom();
  }, [scrollToBottom]);

  return (
    <div className="absolute -top-3 right-3 mx-auto flex h-0 w-full justify-center px-4 md:px-0">
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
              <IconButton
                onClick={handleScrollToBottom}
                className="rounded-full"
              >
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

const ThreadPlaceholder = ({
  children,
  className,
  ...props
}: ThreadPlaceholderProps) => (
  <div
    data-slot="thread-placeholder"
    className={cn(
      "flex flex-1 flex-col items-center justify-center gap-4",
      className,
    )}
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
  Spacer: DynamicSpacer,
});
