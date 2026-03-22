"use client";

import type { FileUIPart, UIMessage } from "ai";
import { CheckIcon, FileIcon, PaperclipIcon } from "lucide-react";
import { motion } from "motion/react";
import Image from "next/image";
import type { ComponentProps } from "react";
import HoverCard from "@/components/ui/hover-card";
import { IconButton } from "@/components/ui/icon-button";
import { Markdown } from "@/components/ui/markdown";
import Tooltip from "@/components/ui/tooltip";
import { useCopy } from "@/hooks/use-copy";
import { cn } from "@/lib/utils";
import { CopyIcon } from "../icons/copy";

type MessageRootProps = {
  role: UIMessage["role"];
  isLast: boolean;
  isError: boolean;
} & ComponentProps<typeof motion.div>;
// Message wrapper with entrance animation
const MessageRoot = ({
  role,
  isLast,
  isError,
  className,
  ...props
}: MessageRootProps) => {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2, ease: "easeOut" }}
      data-slot="message"
      data-role={role}
      data-error={isError ? "" : undefined}
      data-last={isLast ? "" : undefined}
      className={cn(
        "group flex w-full flex-col gap-2 data-[role=assistant]:items-start data-[role=user]:items-end",
        className,
      )}
      {...props}
    />
  );
};

// Message content container with role-based styling
const MessageContent = ({ className, ...props }: ComponentProps<"div">) => (
  <div
    data-slot="message-content"
    className={cn(
      "flex flex-col gap-4 overflow-hidden border",
      // User message styling
      "group-data-[role=user]:max-w-[80%] group-data-[role=user]:border-slate-8 group-data-[role=user]:bg-slate-1 group-data-[role=user]:px-3 group-data-[role=user]:py-2 group-data-[role=user]:shadow-xs group-data-[role=user]:min-h-10 group-data-[role=user]:rounded-[20px]",
      // Assistant message styling
      "group-data-[role=assistant]:w-full group-data-[role=assistant]:border-none",
      // Error styling
      "group-data-[error=true]:border-destructive group-data-[error=true]:bg-destructive/10",
      className,
    )}
    {...props}
  />
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
        "inline-flex items-center justify-start gap-1 transition-opacity",
        // Hidden by default
        "pointer-events-none opacity-0",
        // Show on hover for all messages
        "group-hover:pointer-events-auto group-hover:opacity-100",
        // Show when focus is within the message
        "group-focus-within:pointer-events-auto group-focus-within:opacity-100",
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

const MessageText = ({
  className,
  ...props
}: ComponentProps<typeof Markdown>) => (
  <Markdown className={cn("size-full", className)} {...props} />
);

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
      "flex items-start gap-1 text-sm text-muted-foreground",
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

// Attachments container for message history (read-only)
const MessageAttachments = ({
  children,
  className,
  ...props
}: ComponentProps<"div">) => (
  <div className={cn("flex flex-wrap gap-2", className)} {...props}>
    {children}
  </div>
);

// Individual attachment display (read-only, no remove button)
const isImage = (mediaType: string) => mediaType.startsWith("image/");

type MessageAttachmentProps = {
  attachment: FileUIPart;
} & ComponentProps<"div">;

const MessageAttachment = ({
  attachment,
  className,
  ...props
}: MessageAttachmentProps) => {
  const mediaType = attachment.mediaType ?? "";
  const filename = attachment.filename ?? "Attachment";
  const Icon = mediaType === "application/pdf" ? FileIcon : PaperclipIcon;

  return (
    <div
      className={cn(
        "flex h-10 max-w-48 items-center gap-2 rounded-lg border border-slate-7 bg-slate-1 px-2",
        className,
      )}
      {...props}
    >
      {isImage(mediaType) ? (
        <HoverCard>
          <HoverCard.Trigger className="shrink-0">
            <Image
              width={32}
              height={32}
              alt={filename}
              className="size-6 shrink-0 rounded-xs object-cover ring-1 ring-inset ring-slate-7/10"
              src={attachment.url}
            />
          </HoverCard.Trigger>
          <HoverCard.Content side="top" sideOffset={12} className="w-auto p-1">
            <Image
              width={320}
              height={320}
              alt={filename}
              className="max-h-64 w-auto rounded-md object-contain"
              src={attachment.url}
            />
          </HoverCard.Content>
        </HoverCard>
      ) : (
        <div className="flex size-10 shrink-0 items-center justify-center rounded-md bg-slate-4">
          <Icon className="size-4 text-muted-foreground" />
        </div>
      )}
      <div className="flex min-w-0 flex-col">
        <span className="flex text-xs font-medium">
          <span className="truncate">{filename.slice(0, -7)}</span>
          <span className="shrink-0">{filename.slice(-7)}</span>
        </span>
      </div>
    </div>
  );
};

// Source pills container
const MessageSources = ({
  children,
  className,
  ...props
}: ComponentProps<"div">) => (
  <div
    data-slot="message-sources"
    className={cn("flex flex-wrap gap-1.5", className)}
    {...props}
  >
    {children}
  </div>
);

// Individual source pill with favicon + domain
const MessageSource = ({
  url,
  domain,
  className,
  ...props
}: { url: string; domain: string } & ComponentProps<"a">) => (
  <a
    href={url}
    target="_blank"
    rel="noopener noreferrer"
    className={cn(
      "inline-flex items-center gap-1.5 rounded-md border border-slate-6 bg-slate-1 px-2 py-1 text-xs text-slate-11 transition-colors hover:bg-slate-3",
      className,
    )}
    {...props}
  >
    <img
      src={`https://www.google.com/s2/favicons?domain=${domain}&sz=16`}
      alt=""
      width={14}
      height={14}
      className="shrink-0"
    />
    {domain}
  </a>
);

// Composed Message component
export const Message = Object.assign(MessageRoot, {
  Content: MessageContent,
  Attachments: MessageAttachments,
  Attachment: MessageAttachment,
  Actions: MessageActions,
  Action: MessageAction,
  Copy: MessageCopy,
  Text: MessageText,
  Error: MessageError,
  Loading: MessageLoading,
  Timestamp: MessageTimestamp,
  Sources: MessageSources,
  Source: MessageSource,
});
