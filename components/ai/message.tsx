"use client";

import { Popover as PopoverPrimitive } from "@base-ui/react/popover";
import type { ChipData } from "@intentface/chat/chip-markdown";
import {
  Message as MessagePrimitive,
  useMessageSelection,
  useMessageSelectionScope,
} from "@intentface/chat/message";
import { PaperclipIcon } from "lucide-react";
import { motion } from "motion/react";
import Image from "next/image";
import { type ComponentProps, useMemo } from "react";
import { Chip } from "@/components/ai/chip";
import Button from "@/components/ui/button";
import HoverCard from "@/components/ui/hover-card";
import { IconButton } from "@/components/ui/icon-button";
import { Markdown } from "@/components/ui/markdown";
import Tooltip from "@/components/ui/tooltip";
import { useCopy } from "@/hooks/use-copy";
import { isImageAttachment, isPdfAttachment } from "@/lib/ai/attachments";
import { CHIP_ICONS, isChipIconKey } from "@/lib/ai/chip-icons";
import { cn } from "@/lib/utils";
import { Bubble5Icon } from "../icons/bubble-5";
import { CheckMarkMediumIcon } from "../icons/check-mark-medium";
import { CopyIcon } from "../icons/copy";
import { FileBendIcon } from "../icons/file-bend";
import { StopIcon } from "../icons/stop";

type MessageRootProps = ComponentProps<typeof MessagePrimitive>;

// Message wrapper with entrance animation: the primitive owns the state/data
// attributes and merges them onto the motion element via the render prop.
const MessageRoot = ({ className, ...props }: MessageRootProps) => (
  <MessagePrimitive
    render={
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2, ease: "easeOut" }}
      />
    }
    className={cn(
      "group flex w-full flex-col gap-2 data-[role=assistant]:items-start data-[role=user]:items-end",
      // Sticky turns pin the user message as a header — stretch it full width.
      "data-[role=user]:group-data-sticky/turn:items-stretch",
      className,
    )}
    {...props}
  />
);

// Turn wrapper — groups a user message with its trailing assistant reply. The
// auto-scroll reserve lives on Thread's content (its last child), not here.
type MessageTurnProps = ComponentProps<typeof MessagePrimitive.Turn> & {
  // Pin this turn's user message at the top, above the blur overlay (z-2 > the
  // overlay's z-1), so the assistant reply fades out under the blur as it scrolls
  // up to meet the header — instead of colliding with a bubble in the readable
  // area. The turn is the sticky scope, so the pin releases at the turn boundary.
  // Pure CSS — pairs with any auto-scroll mode.
  sticky?: boolean;
};

const MessageTurn = ({ sticky, className, ...props }: MessageTurnProps) => (
  <MessagePrimitive.Turn
    // data-sticky lets descendants restyle for the pinned presentation: a
    // pinned user message reads as a section header, so it goes full-width
    // and left-aligned instead of a right-hugging bubble.
    data-sticky={sticky ? "" : undefined}
    className={cn(
      "group/turn flex w-full flex-col gap-4 [overflow-anchor:none]",
      sticky && "*:data-[role=user]:sticky *:data-[role=user]:top-4 *:data-[role=user]:z-2",
      className,
    )}
    {...props}
  />
);

// Message content container with role-based styling
const MessageContent = ({ className, ...props }: ComponentProps<"div">) => (
  <div
    data-slot="message-content"
    className={cn(
      "flex flex-col gap-4 overflow-hidden border",
      // User message styling — edge is shadow-drawn (shadow-border), matching
      // the composer and playground cards.
      "group-data-[role=user]:max-w-[80%] group-data-[role=user]:border group-data-[role=user]:bg-primary-bg group-data-[role=user]:px-3 group-data-[role=user]:py-1.5 group-data-[role=user]:shadow-xs group-data-[role=user]:border-primary-border group-data-[role=user]:min-h-9 group-data-[role=user]:rounded-[20px]",
      // Sticky turns: the pinned user message spans the column, text left.
      "group-data-[role=user]:group-data-sticky/turn:max-w-none",
      // Assistant message styling
      "group-data-[role=assistant]:w-full group-data-[role=assistant]:border-none",
      // Error styling — presence attribute (data-error=""), not a value match.
      "group-data-error:border-destructive group-data-error:bg-destructive/10",
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

// The wire format carries the icon as an opaque string; narrow it to this
// app's concrete keys here — unknown values fall back to no icon.
const MessageChip = ({ label, chip, className }: MessageChipProps) => {
  const icon = chip?.icon && isChipIconKey(chip.icon) ? CHIP_ICONS[chip.icon] : undefined;
  return (
    <Chip className={className}>
      {icon && <Chip.Icon>{icon}</Chip.Icon>}
      <Chip.Label>{label}</Chip.Label>
    </Chip>
  );
};

type MessageTextProps = {
  children: string;
  className?: string;
};

const MessageText = ({ children, className }: MessageTextProps) => (
  <MessagePrimitive.Text
    className={cn("whitespace-pre-wrap text-md", className)}
    renderChip={(segment) => <MessageChip label={segment.label} chip={segment} />}
  >
    {children}
  </MessagePrimitive.Text>
);

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
// mid-stream. Message.Selection is scoped to message-content, so this marker
// (a sibling outside it) never triggers the "Add to chat" popover.
const MessageStopped = ({ className, ...props }: ComponentProps<"div">) => (
  <div
    data-slot="message-stopped"
    className={cn("flex w-full justify-center", className)}
    {...props}
  >
    <span className="inline-flex items-center gap-1.5 rounded-full border border-primary-border bg-primary-bg px-2.5 py-1 text-xs text-ink-secondary">
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
const MessageAttachments = ({ className, ...props }: ComponentProps<"div">) => (
  <div
    data-slot="message-attachments"
    className={cn("flex flex-wrap gap-2", className)}
    {...props}
  />
);

// Individual attachment display (read-only, no remove button). Categorization
// reuses the package's shared media helpers instead of a third local copy.
type MessageAttachmentProps = {
  attachment: { url: string; mediaType?: string; filename?: string };
} & ComponentProps<"div">;

const MessageAttachment = ({ attachment, className, ...props }: MessageAttachmentProps) => {
  const mediaType = attachment.mediaType ?? "";
  const filename = attachment.filename ?? "Attachment";
  const Icon = isPdfAttachment(mediaType) ? FileBendIcon : PaperclipIcon;

  return (
    <div
      className={cn(
        "flex h-10 max-w-48 items-center gap-2 rounded-lg border border-slate-7 bg-primary-bg px-2",
        className,
      )}
      {...props}
    >
      {isImageAttachment(mediaType) ? (
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
        <div className="flex size-10 shrink-0 items-center justify-center rounded-md bg-primary-bg-hover">
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
// Message.Selection — floating "Add to chat" bar above a text selection
// within this message's content. The selection detection and content scoping
// live in the headless package; this wrapper anchors the popover UI.
// ---------------------------------------------------------------------------

type MessageSelectionProps = {
  onAdd: (text: string) => void;
  className?: string;
};

const MessageSelection = ({ onAdd, className }: MessageSelectionProps) => {
  const { anchorRef, contentElement } = useMessageSelectionScope();
  const selection = useMessageSelection(contentElement);

  // Virtual anchor over the live Range — Floating UI's auto-update re-reads
  // the rect, so the toolbar tracks the selection through scrolls and
  // reflows. contextElement supplies the scroll ancestors to observe.
  const anchor = useMemo(
    () =>
      selection && contentElement
        ? {
            getBoundingClientRect: () => selection.range.getBoundingClientRect(),
            contextElement: contentElement,
          }
        : null,
    [selection, contentElement],
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
              data-slot="message-selection"
              role="toolbar"
              aria-label="Selection actions"
              initialFocus={false}
              finalFocus={false}
              className={cn(
                "flex items-center gap-1 rounded-full border border-primary-border bg-primary-bg p-0.5 shadow-md outline-none",
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
                <Bubble5Icon className="size-3.5" />
                Add to chat
              </Button>
            </PopoverPrimitive.Popup>
          </PopoverPrimitive.Positioner>
        </PopoverPrimitive.Portal>
      </PopoverPrimitive.Root>
    </>
  );
};

// Source pills container. App-owned — which sources show and how they link is
// product policy, so there is no package primitive behind these.
const MessageSources = ({ className, ...props }: ComponentProps<"div">) => (
  <div data-slot="message-sources" className={cn("flex flex-wrap gap-1.5", className)} {...props} />
);

// Individual source pill with favicon + domain
const MessageSource = ({
  url,
  domain,
  className,
  ...props
}: { url: string; domain: string } & ComponentProps<"a">) => (
  <a
    data-slot="message-source"
    href={url}
    target="_blank"
    rel="noopener noreferrer"
    className={cn(
      "inline-flex items-center gap-1.5 rounded-md border border-primary-border bg-primary-bg px-2 py-1 text-xs text-ink-secondary transition-colors hover:bg-primary-bg-hover",
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
  Sources: MessageSources,
  Source: MessageSource,
  Selection: MessageSelection,
});
