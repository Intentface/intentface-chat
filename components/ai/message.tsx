"use client";

import type { UIMessage } from "ai";
import { motion } from "motion/react";
import { type ComponentProps, memo } from "react";
import { Streamdown } from "streamdown";
import { cn } from "@/lib/utils";

// Message wrapper with entrance animation
const MessageRoot = ({
  messageId,
  role,
  hasError,
  isLoading,
  className,
  ...props
}: ComponentProps<typeof motion.div> & {
  messageId: string;
  role: UIMessage["role"];
  hasError?: boolean;
  isLoading?: boolean;
}) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      data-slot="message"
      data-role={role}
      data-message-id={messageId}
      data-error={hasError}
      data-loading={isLoading}
      className={cn(
        "group flex w-full gap-2 data-[role=assistant]:justify-start data-[role=user]:justify-end",
        className,
      )}
      {...props}
    />
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
  <div
    data-slot="message-actions"
    className={cn("flex items-center justify-start gap-2", className)}
    {...props}
  >
    {children}
  </div>
);

// Memoized markdown text renderer using Streamdown
const MessageText = memo(
  ({ className, ...props }: ComponentProps<typeof Streamdown>) => (
    <Streamdown
      className={cn(
        "size-full text-sm [&>*:first-child]:mt-0 [&>*:last-child]:mb-0",
        className,
      )}
      components={{
        p: ({ children, ...props }) => (
          <p className="whitespace-pre-wrap" {...props}>
            {children}
          </p>
        ),
      }}
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

// Composed Message component
export const Message = Object.assign(MessageRoot, {
  Content: MessageContent,
  Actions: MessageActions,
  Text: MessageText,
  Error: MessageError,
  Loading: MessageLoading,
});
