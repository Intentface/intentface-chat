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

export type ThreadOverlayProps = ComponentProps<typeof ProgressiveBlur> & {
  direction: "top" | "bottom";
};

const ThreadOverlay = memo(
  ({ className, direction, ...props }: ThreadOverlayProps) => (
    <div
      data-slot="thread-overlay-top"
      data-thread-overlay={direction}
      style={
        {
          "--thread-overlay-top-height": "4rem",
          "--thread-overlay-bottom-height": "8rem",
        } as React.CSSProperties
      }
      className={cn(
        "absolute right-0 left-0 z-1 mx-auto w-full max-w-(--thread-width)",
        'data-[thread-overlay="top"]:h-(--thread-overlay-top-height) data-[thread-overlay="top"]:top-0',
        'data-[thread-overlay="bottom"]:h-(--thread-overlay-bottom-height) data-[thread-overlay="bottom"]:bottom-0',
        className,
      )}
    >
      <ProgressiveBlur
        direction={direction}
        className={cn(
          "h-full w-full bg-linear-to-b from-background to-transparent",
          direction === "top" ? "bg-linear-to-b" : "bg-linear-to-t",
        )}
        {...props}
      />
    </div>
  ),
);

ThreadOverlay.displayName = "ThreadOverlay";

// export type ThreadOverlayBottomProps = Omit<
//   ComponentProps<typeof ProgressiveBlur>,
//   "direction"
// >;

// const ThreadOverlayBottom = memo(
//   ({ className, ...props }: ThreadOverlayBottomProps) => (
//     <div
//       data-slot="thread-overlay-bottom"
//       data-thread-overlay="bottom"
//       className={cn(
//         "absolute right-0 bottom-0 left-0 z-1 mx-auto h-32 w-full max-w-(--thread-width)",
//         className,
//       )}
//     >
//       <ProgressiveBlur
//         direction="bottom"
//         className="h-full w-full bg-linear-to-t from-background to-transparent"
//         {...props}
//       />
//     </div>
//   ),
// );

// ThreadOverlayBottom.displayName = "ThreadOverlayBottom";

const ThreadRoot = ({ children, className, ...props }: ThreadRootProps) => (
  <StickToBottom
    data-slot="thread-root"
    className={cn(
      "relative flex h-full w-full overflow-hidden bg-background border border-transparent",
      "group-data-expanded/sidebar-inset:border-border group-data-expanded/sidebar-inset:rounded-md",
      className,
    )}
    initial="smooth"
    resize="smooth"
    role="log"
    {...props}
  >
    {/* <ProgressiveBlur
      direction="top"
      className="absolute top-0 left-0 right-0 z-1 mx-auto w-full  max-w-(--thread-width) h-(--header-height) bg-linear-to-b from-background to-transparent"
    />
    <ProgressiveBlur
      direction="bottom"
      className="absolute bottom-0 left-0 right-0 z-1 mx-auto w-full max-w-(--thread-width) h-32 bg-linear-to-t from-background to-transparent"
    /> */}
    {children}
  </StickToBottom>
);

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
        "relative flex w-full min-w-[340px] flex-col items-center px-4",
        className,
      )}
      {...props}
    >
      <div className="relative flex h-full w-full flex-col items-center pt-(--thread-overlay-top-height) pb-(--thread-overlay-bottom-height)">
        <div className="mx-auto flex h-full w-full max-w-(--thread-width) flex-col gap-8">
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
    {/* <ProgressiveBlur
      className="absolute inset-x-0 bottom-0 h-32 bg-linear-to-t from-background to-transparent pointer-events-none"
      direction="bottom"
    /> */}
    <div className="relative flex w-full flex-col items-center px-4 pb-2 sm:px-0 sm:pb-4">
      {children}
    </div>
  </div>
);

export type ThreadEmptyStateProps = ComponentProps<"div"> & {
  title?: string;
  description?: string;
  icon?: React.ReactNode;
};

export type ThreadScrollButtonProps = ComponentProps<typeof motion.button>;

const ThreadScrollButton = ({
  className,
  ...props
}: ThreadScrollButtonProps) => {
  const { isAtBottom, scrollToBottom } = useStickToBottomContext();

  const handleScrollToBottom = useCallback(() => {
    scrollToBottom();
  }, [scrollToBottom]);

  return (
    <div className="absolute -top-3 mx-auto flex h-0 w-full justify-center px-4 md:px-0">
      <div className="z-2 flex h-0 w-full max-w-(--thread-width) items-end justify-end">
        <AnimatePresence>
          {!isAtBottom && (
            <motion.button
              type="button"
              aria-label="Scroll to bottom"
              initial={{ opacity: 0, y: 8, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 8, scale: 0.9 }}
              transition={{ duration: 0.2, ease: "easeOut" }}
              className={cn(
                "inline-flex size-8 items-center justify-center cursor-pointer rounded-full border border-border bg-muted text-muted-foreground shadow-sm transition-colors",
                "hover:bg-accent hover:text-foreground [&>svg]:size-4",
                className,
              )}
              onClick={handleScrollToBottom}
              {...props}
            >
              <ArrowDownIcon />
            </motion.button>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};

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
      className={cn(
        "absolute top-4 right-4 rounded-full dark:bg-background dark:hover:bg-muted",
        className,
      )}
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
  ScrollButton: ThreadScrollButton,
  Download: ThreadDownload,
});
