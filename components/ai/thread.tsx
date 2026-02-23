"use client";

import { DownloadIcon } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import type { ComponentProps, ReactNode } from "react";
import { memo, useCallback } from "react";
import { StickToBottom, useStickToBottomContext } from "use-stick-to-bottom";
import type Button from "@/components/ui/button";
import { IconButton } from "@/components/ui/icon-button";
import { ProgressiveBlur } from "@/components/ui/progressive-blur";
import { cn } from "@/lib/utils";
import { ArrowDownIcon } from "../icons/arrow-down";

export type ThreadRootProps = ComponentProps<typeof StickToBottom> & {
  children?: ReactNode;
};

const ThreadRoot = ({ children, className, ...props }: ThreadRootProps) => (
  <StickToBottom
    data-slot="thread-root"
    className={cn(
      "relative flex h-full w-full overflow-hidden [--thread-overlay-top-height:4rem] [--thread-overlay-bottom-height:8rem]",
      className,
    )}
    initial="smooth"
    resize="smooth"
    role="log"
    {...props}
  >
    {children}
  </StickToBottom>
);

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

export type ThreadViewportProps = ComponentProps<
  typeof StickToBottom.Content
> & {
  children?: ReactNode;
};

const ThreadViewport = ({
  children,
  className,
  ...props
}: ThreadViewportProps) => {
  return (
    <StickToBottom.Content
      data-slot="thread-viewport"
      scrollClassName="h-full w-full overflow-y-auto overflow-x-hidden [scrollbar-gutter:stable]"
      className={cn(
        "relative @container/thread-viewport flex w-full min-w-[340px] flex-col items-center",
        className,
      )}
      {...props}
    >
      <div className="relative flex h-full w-full flex-col items-center pt-(--thread-overlay-top-height) pb-(--thread-overlay-bottom-height)">
        <div
          className={cn(
            "mx-auto px-4 flex h-full w-full max-w-(--thread-width) flex-col gap-4",
            // Add min-height on last child to prevent layout jump
            "[&>[data-slot=message]:last-child]:min-h-[50vh]",
          )}
        >
          {children}
        </div>
      </div>
    </StickToBottom.Content>
  );
};

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

export type ThreadEmptyStateProps = ComponentProps<"div"> & {
  title?: string;
  description?: string;
  icon?: React.ReactNode;
};

export type ThreadScrollButtonProps = ComponentProps<typeof motion.div>;

const ThreadScrollButton = ({
  className,
  ...props
}: ThreadScrollButtonProps) => {
  const { isAtBottom, scrollToBottom } = useStickToBottomContext();

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

export interface ThreadMessage {
  role: "user" | "assistant" | "system" | "data" | "tool";
  content: string;
}

export type ThreadDownloadProps = Omit<
  ComponentProps<typeof Button>,
  "onClick"
> & {
  messages: ThreadMessage[];
  filename?: string;
  formatMessage?: (message: ThreadMessage, index: number) => string;
};

const defaultFormatMessage = (message: ThreadMessage): string => {
  const roleLabel =
    message.role.charAt(0).toUpperCase() + message.role.slice(1);
  return `**${roleLabel}:** ${message.content}`;
};

export const messagesToMarkdown = (
  messages: ThreadMessage[],
  formatMessage: (
    message: ThreadMessage,
    index: number,
  ) => string = defaultFormatMessage,
): string => messages.map((msg, i) => formatMessage(msg, i)).join("\n\n");

const ThreadDownload = ({
  messages,
  filename = "conversation.md",
  formatMessage = defaultFormatMessage,
  className,
  children,
  ...props
}: ThreadDownloadProps) => {
  const handleDownload = useCallback(() => {
    const markdown = messagesToMarkdown(messages, formatMessage);
    const blob = new Blob([markdown], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.append(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }, [messages, filename, formatMessage]);

  return (
    <IconButton
      onClick={handleDownload}
      size="xs"
      type="button"
      variant="outline"
      {...props}
    >
      {children ?? <DownloadIcon className="size-4" />}
    </IconButton>
  );
};

export const Thread = Object.assign(ThreadRoot, {
  Overlay: ThreadOverlay,
  Viewport: ThreadViewport,
  Composer: ThreadComposer,
  Placeholder: ThreadPlaceholder,
  ScrollButton: ThreadScrollButton,
  Download: ThreadDownload,
});
