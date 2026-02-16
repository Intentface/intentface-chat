"use client";

import type { ChatStatus, UIMessage } from "ai";
import { CheckIcon } from "lucide-react";
import { motion } from "motion/react";
import { type ComponentProps, memo } from "react";
import { Streamdown } from "streamdown";
import { IconButton } from "@/components/ui/icon-button";
import Tooltip from "@/components/ui/tooltip";
import { useCopy } from "@/hooks/use-copy";
import { cn } from "@/lib/utils";
import { CopyIcon } from "../icons/copy";

type MessageRootProps = {
  messageId: string;
  role: UIMessage["role"];
  status: ChatStatus;
  isLast: boolean;
} & ComponentProps<typeof motion.div>;
// Message wrapper with entrance animation
const MessageRoot = ({
  messageId,
  role,
  status,
  isLast,
  className,
  children,
  ...props
}: MessageRootProps) => {
  const isError = status === "error";

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.15 }}
      data-slot="message"
      data-role={role}
      data-message-id={messageId}
      data-status={status}
      data-error={isError ? "" : undefined}
      data-last={isLast ? "" : undefined}
      className={cn(
        "group flex w-full flex-col gap-2 data-[role=assistant]:items-start data-[role=user]:items-end",
        className,
      )}
      {...props}
    >
      {children}
    </motion.div>
  );
};

// Message content container with role-based styling
const MessageContent = ({
  children,
  className,
  ...props
}: ComponentProps<"div">) => (
  <div
    data-slot="message-content"
    className={cn(
      "flex flex-col gap-4 overflow-hidden border",
      // User message styling
      "group-data-[role=user]:max-w-[80%] group-data-[role=user]:rounded-xl group-data-[role=user]:border-border group-data-[role=user]:bg-muted group-data-[role=user]:px-3 group-data-[role=user]:py-2",
      // Assistant message styling
      "group-data-[role=assistant]:w-full group-data-[role=assistant]:border-transparent",
      // Error styling
      "group-data-[error=true]:border-destructive group-data-[error=true]:bg-destructive/10",
      className,
    )}
    {...props}
  >
    {children}
  </div>
);

// Actions container (for copy, regenerate, etc.)
const MessageActions = ({
  children,
  className,
  ...props
}: ComponentProps<"div">) => (
  <Tooltip.Provider>
    <div
      data-slot="message-actions"
      className={cn(
        "inline-flex items-center justify-start gap-2",
        // Hidden by default
        "pointer-events-none opacity-0",
        // Show on hover for all messages
        "group-hover:pointer-events-auto group-hover:opacity-100",
        // Show when focus is within the message
        "group-focus-within:pointer-events-auto group-focus-within:opacity-100",
        // Hide when streaming (only for assistant messages)
        "group-data-[role=assistant]:group-data-[status=streaming]:pointer-events-none! group-data-[role=assistant]:group-data-[status=streaming]:opacity-0!",
        className,
      )}
      {...props}
    >
      {children}
    </div>
  </Tooltip.Provider>
);

// Action button with tooltip
const MessageAction = ({
  tooltip,
  children,
  ...props
}: ComponentProps<typeof IconButton> & { tooltip?: string }) => {
  if (!tooltip) {
    return (
      <IconButton variant="ghost" size="sm" {...props}>
        {children}
      </IconButton>
    );
  }

  return (
    <Tooltip>
      <Tooltip.Trigger
        render={
          <IconButton variant="ghost" size="sm" {...props}>
            {children}
          </IconButton>
        }
      />
      <Tooltip.Content>{tooltip}</Tooltip.Content>
    </Tooltip>
  );
};

// Memoized markdown text renderer using Streamdown
const MessageText = memo(
  ({ className, ...props }: ComponentProps<typeof Streamdown>) => (
    <Streamdown
      className={cn(
        "size-full text-md [&_p]:whitespace-pre-wrap [&>*:first-child]:mt-0 [&>*:last-child]:mb-0",
        className,
      )}
      {...props}
    />
  ),
  (prevProps, nextProps) => prevProps.children === nextProps.children,
);

MessageText.displayName = "MessageText";

// Error message display
const MessageError = ({
  children,
  className,
  ...props
}: ComponentProps<"div">) => (
  <div
    data-slot="message-error"
    className={cn("flex items-start gap-2 text-sm text-destructive", className)}
    {...props}
  >
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 20 20"
      fill="currentColor"
      className="size-5 shrink-0"
      aria-hidden="true"
    >
      <path
        fillRule="evenodd"
        d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-5a.75.75 0 01.75.75v4.5a.75.75 0 01-1.5 0v-4.5A.75.75 0 0110 5zm0 10a1 1 0 100-2 1 1 0 000 2z"
        clipRule="evenodd"
      />
    </svg>
    <div className="flex-1">{children}</div>
  </div>
);

// Loading indicator with animated dots
const MessageLoading = ({ className, ...props }: ComponentProps<"div">) => (
  <div
    data-slot="message-loading"
    className={cn(
      "flex items-center gap-1 text-sm text-muted-foreground",
      className,
    )}
    {...props}
  >
    <span>Loading...</span>
  </div>
);

// Timestamp display
const MessageTimestamp = ({
  timestamp,
  className,
  ...props
}: ComponentProps<"span"> & { timestamp: Date | string | number }) => {
  const date = new Date(timestamp);
  const formattedTime = date.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });

  return (
    <span
      data-slot="message-timestamp"
      className={cn("text-xs text-muted-foreground", className)}
      {...props}
    >
      {formattedTime}
    </span>
  );
};

// Copy button with individual state
const MessageCopy = ({
  value,
  className,
  ...props
}: Omit<ComponentProps<typeof IconButton>, "children"> & { value: string }) => {
  const { copy, isCopied } = useCopy();

  return (
    <Tooltip>
      <Tooltip.Trigger
        render={
          <IconButton
            variant="ghost"
            size="sm"
            onClick={() => copy(value)}
            className={className}
            {...props}
          >
            {isCopied ? <CheckIcon /> : <CopyIcon />}
          </IconButton>
        }
      />
      <Tooltip.Content>{isCopied ? "Copied!" : "Copy"}</Tooltip.Content>
    </Tooltip>
  );
};

// Composed Message component
export const Message = Object.assign(MessageRoot, {
  Content: MessageContent,
  Actions: MessageActions,
  Action: MessageAction,
  Copy: MessageCopy,
  Text: MessageText,
  Error: MessageError,
  Loading: MessageLoading,
  Timestamp: MessageTimestamp,
});
