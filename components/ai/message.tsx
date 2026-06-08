"use client";

import { Popover as PopoverPrimitive } from "@base-ui/react/popover";
import type { FileUIPart, UIMessage } from "ai";
import { FileIcon, MessageCircleIcon, PaperclipIcon } from "lucide-react";
import { motion } from "motion/react";
import Image from "next/image";
import { type ComponentProps, Fragment, useCallback, useEffect, useMemo, useState } from "react";
import { Chip } from "@/components/ai/chip";
import type { ChipData } from "@/components/ai/composer";
import Button from "@/components/ui/button";
import HoverCard from "@/components/ui/hover-card";
import { IconButton } from "@/components/ui/icon-button";
import { Markdown } from "@/components/ui/markdown";
import Tooltip from "@/components/ui/tooltip";
import { useCopy } from "@/hooks/use-copy";
import { CHIP_ICONS } from "@/lib/ai/chip-icons";
import { parseChipSegments } from "@/lib/ai/chip-markdown";
import { cn } from "@/lib/utils";
import { CheckMarkMediumIcon } from "../icons/check-mark-medium";
import { CopyIcon } from "../icons/copy";
import { StopIcon } from "../icons/stop";

type MessageRootProps = {
  role: UIMessage["role"];
  isLast: boolean;
  isError: boolean;
} & ComponentProps<typeof motion.div>;
// Message wrapper with entrance animation
const MessageRoot = ({ role, isLast, isError, className, ...props }: MessageRootProps) => {
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

// Turn wrapper — groups a user message with its trailing assistant reply. The
// auto-scroll reserve lives on Thread's content (its last child), not here.
const MessageTurn = ({ className, ...props }: ComponentProps<"div">) => (
  <div
    data-slot="message-turn"
    className={cn("flex w-full flex-col gap-4 [overflow-anchor:none]", className)}
    {...props}
  />
);

// Message content container with role-based styling
const MessageContent = ({ className, ...props }: ComponentProps<"div">) => (
  <div
    data-slot="message-content"
    className={cn(
      "flex flex-col gap-4 overflow-hidden border",
      // User message styling
      "group-data-[role=user]:max-w-[80%] group-data-[role=user]:border-primary-border group-data-[role=user]:bg-primary group-data-[role=user]:px-3 group-data-[role=user]:py-1.5 group-data-[role=user]:shadow-xs group-data-[role=user]:min-h-9 group-data-[role=user]:rounded-[20px]",
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
const MessageActions = ({ children, className, ...props }: ComponentProps<"div">) => (
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

const MessageMarkdown = ({ className, ...props }: ComponentProps<typeof Markdown>) => (
  <Markdown className={cn("size-full", className)} {...props} />
);

type MessageChipProps = {
  label: string;
  chip?: ChipData;
  className?: string;
};

const MessageChip = ({ label, chip, className }: MessageChipProps) => (
  <Chip variant={chip?.variant} className={className}>
    {chip?.icon && <Chip.Icon>{CHIP_ICONS[chip.icon]}</Chip.Icon>}
    <Chip.Label>{label}</Chip.Label>
  </Chip>
);

type MessageTextProps = {
  text: string;
  chips?: ChipData[];
  className?: string;
};

const MessageText = ({ text, chips, className }: MessageTextProps) => {
  const segments = parseChipSegments(text);
  const chipByKey = new Map((chips ?? []).map((c) => [`${c.prefix}:${c.value}`, c]));

  return (
    <span className={cn("whitespace-pre-wrap text-md", className)}>
      {segments.map((segment, index) =>
        segment.type === "text" ? (
          <Fragment key={index}>{segment.text}</Fragment>
        ) : (
          <MessageChip
            key={index}
            label={segment.label}
            chip={chipByKey.get(`${segment.prefix}:${segment.value}`)}
          />
        ),
      )}
    </span>
  );
};

// Error message display
const MessageError = ({ children, className, ...props }: ComponentProps<"div">) => (
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

// Stopped indicator — a centered badge on an assistant turn the user aborted
// mid-stream. The SelectionToolbar is scoped to message-content, so this marker
// (a sibling outside it) never triggers the "Add to chat" popover.
const MessageStopped = ({ className, ...props }: ComponentProps<"div">) => (
  <div
    data-slot="message-stopped"
    className={cn("flex w-full justify-center", className)}
    {...props}
  >
    <span className="inline-flex items-center gap-1.5 rounded-full border border-primary-border bg-primary px-2.5 py-1 text-xs text-ink-secondary">
      <StopIcon className="size-3 shrink-0" />
      Stopped
    </span>
  </div>
);

// Loading indicator with animated dots
const MessageLoading = ({ className, ...props }: ComponentProps<"div">) => (
  <div
    data-slot="message-loading"
    className={cn("flex items-start gap-1 text-sm text-muted-foreground", className)}
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
            {isCopied ? <CheckMarkMediumIcon /> : <CopyIcon />}
          </IconButton>
        }
      />
      <Tooltip.Content>{isCopied ? "Copied!" : "Copy"}</Tooltip.Content>
    </Tooltip>
  );
};

// Attachments container for message history (read-only)
const MessageAttachments = ({ children, className, ...props }: ComponentProps<"div">) => (
  <div className={cn("flex flex-wrap gap-2", className)} {...props}>
    {children}
  </div>
);

// Individual attachment display (read-only, no remove button)
const isImage = (mediaType: string) => mediaType.startsWith("image/");

type MessageAttachmentProps = {
  attachment: FileUIPart;
} & ComponentProps<"div">;

const MessageAttachment = ({ attachment, className, ...props }: MessageAttachmentProps) => {
  const mediaType = attachment.mediaType ?? "";
  const filename = attachment.filename ?? "Attachment";
  const Icon = mediaType === "application/pdf" ? FileIcon : PaperclipIcon;

  return (
    <div
      className={cn(
        "flex h-10 max-w-48 items-center gap-2 rounded-lg border border-slate-7 bg-primary px-2",
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
        <div className="flex size-10 shrink-0 items-center justify-center rounded-md bg-primary-hover">
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

// ---------------------------------------------------------------------------
// Message.SelectionToolbar — floating "Add to chat" bar above a text selection
// within this message's content. An invisible anchor span resolves the owning
// [data-slot="message-content"] element, so the listeners are scoped to the
// answer text — not markers, sources, or actions elsewhere in the message.
// ---------------------------------------------------------------------------

type MessageSelection = {
  text: string;
  range: Range;
};

const readMessageSelection = (scope: HTMLElement): MessageSelection | null => {
  const selection = window.getSelection();
  if (!selection || selection.isCollapsed || selection.rangeCount === 0) return null;

  const text = selection.toString();
  if (text.trim().length === 0) return null;

  // Both endpoints must sit inside this message — a cross-message selection
  // has its common ancestor outside the scope and resolves to null.
  const range = selection.getRangeAt(0);
  if (!scope.contains(range.commonAncestorContainer)) return null;

  // Clone so later mutations of the live selection don't move our anchor.
  return { text, range: range.cloneRange() };
};

// Subscribe to the document selection, scoped to `scope`. Samples when the
// gesture settles (mouseup / keyup) instead of on every selectionchange drag
// tick; selectionchange only clears the value once the selection collapses.
const useMessageSelection = (scope: HTMLElement | null): MessageSelection | null => {
  const [selection, setSelection] = useState<MessageSelection | null>(null);

  useEffect(() => {
    if (!scope) return;

    const readSelection = () => setSelection(readMessageSelection(scope));
    const hideWhenCollapsed = () => {
      const current = window.getSelection();
      if (!current || current.isCollapsed) setSelection(null);
    };

    document.addEventListener("mouseup", readSelection);
    document.addEventListener("keyup", readSelection);
    document.addEventListener("selectionchange", hideWhenCollapsed);
    return () => {
      document.removeEventListener("mouseup", readSelection);
      document.removeEventListener("keyup", readSelection);
      document.removeEventListener("selectionchange", hideWhenCollapsed);
    };
  }, [scope]);

  return selection;
};

type MessageSelectionToolbarProps = {
  onAdd: (text: string) => void;
  className?: string;
};

const MessageSelectionToolbar = ({ onAdd, className }: MessageSelectionToolbarProps) => {
  const [messageElement, setMessageElement] = useState<HTMLElement | null>(null);
  const selection = useMessageSelection(messageElement);

  // Scope to the owning message's content — the assistant's answer text. The
  // anchor sits outside it (sibling), so resolve the message root first, then
  // its content child. Markers like message-stopped, sources, and reasoning
  // live outside message-content and so never raise the toolbar.
  const anchorRef = useCallback((node: HTMLSpanElement | null) => {
    const messageRoot = node?.closest<HTMLElement>('[data-slot="message"]');
    setMessageElement(
      messageRoot?.querySelector<HTMLElement>('[data-slot="message-content"]') ?? null,
    );
  }, []);

  // Virtual anchor over the live Range — Floating UI's auto-update re-reads
  // the rect, so the toolbar tracks the selection through scrolls and
  // reflows. contextElement supplies the scroll ancestors to observe.
  const anchor = useMemo(
    () =>
      selection && messageElement
        ? {
            getBoundingClientRect: () => selection.range.getBoundingClientRect(),
            contextElement: messageElement,
          }
        : null,
    [selection, messageElement],
  );

  return (
    <>
      <span ref={anchorRef} data-slot="message-selection-anchor" hidden />
      <PopoverPrimitive.Root
        open={selection !== null}
        onOpenChange={(open, eventDetails) => {
          // Only honor Escape. The select-drag's trailing click registers as
          // an outside press and must not dismiss — and a genuine outside
          // click collapses the selection natively, which already closes the
          // toolbar through the selectionchange listener.
          if (!open && eventDetails.reason === "escape-key") {
            window.getSelection()?.removeAllRanges();
          }
        }}
        modal={false}
      >
        <PopoverPrimitive.Portal>
          <PopoverPrimitive.Positioner
            className="isolate z-50 outline-none"
            anchor={anchor}
            side="top"
            sideOffset={8}
          >
            <PopoverPrimitive.Popup
              data-slot="message-selection-toolbar"
              role="toolbar"
              aria-label="Selection actions"
              initialFocus={false}
              finalFocus={false}
              className={cn(
                "flex items-center gap-1 rounded-full border border-primary-border bg-primary p-0.5 shadow-md outline-none",
                "data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95",
                "data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95",
                "duration-100",
                className,
              )}
              // Keep the selection alive while clicking inside the toolbar.
              onMouseDown={(event) => event.preventDefault()}
            >
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="gap-1.5 rounded-full"
                onClick={() => {
                  if (selection) onAdd(selection.text);
                  window.getSelection()?.removeAllRanges();
                }}
              >
                <MessageCircleIcon className="size-3.5" />
                Add to chat
              </Button>
            </PopoverPrimitive.Popup>
          </PopoverPrimitive.Positioner>
        </PopoverPrimitive.Portal>
      </PopoverPrimitive.Root>
    </>
  );
};

// Source pills container
const MessageSources = ({ children, className, ...props }: ComponentProps<"div">) => (
  <div data-slot="message-sources" className={cn("flex flex-wrap gap-1.5", className)} {...props}>
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
      "inline-flex items-center gap-1.5 rounded-md border border-primary-border bg-primary px-2 py-1 text-xs text-ink-secondary transition-colors hover:bg-primary-hover",
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
  Turn: MessageTurn,
  Content: MessageContent,
  Attachments: MessageAttachments,
  Attachment: MessageAttachment,
  Actions: MessageActions,
  Action: MessageAction,
  Copy: MessageCopy,
  Text: MessageText,
  Markdown: MessageMarkdown,
  Chip: MessageChip,
  Error: MessageError,
  Stopped: MessageStopped,
  Loading: MessageLoading,
  Timestamp: MessageTimestamp,
  Sources: MessageSources,
  Source: MessageSource,
  SelectionToolbar: MessageSelectionToolbar,
});
