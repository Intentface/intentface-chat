"use client";

// Headless message parts. Owns the role/error/last data-attribute contract,
// chip-segment text parsing (with render inversion for markdown/styled chips),
// timestamp formatting, and the text-selection subsystem. Entrance animation,
// popovers, tooltips, icons, and thumbnails belong to the styled layer.

import {
  type ComponentProps,
  Fragment,
  type ReactNode,
  useCallback,
  useEffect,
  useState,
} from "react";
import { type ChipSegment, parseChipSegments } from "./chip-markdown";
import type { MessageRole } from "./types";

// ---------------------------------------------------------------------------
// Root — data-attribute contract: data-slot="message", data-role, data-error,
// data-last. The selection toolbar and thread spacing query these.
// ---------------------------------------------------------------------------

export type MessageRootProps = ComponentProps<"div"> & {
  role: MessageRole;
  isLast?: boolean;
  isError?: boolean;
};

const MessageRoot = ({ role, isLast, isError, ...props }: MessageRootProps) => (
  <div
    data-slot="message"
    data-role={role}
    data-error={isError ? "" : undefined}
    data-last={isLast ? "" : undefined}
    {...props}
  />
);

// ---------------------------------------------------------------------------
// Structural parts
// ---------------------------------------------------------------------------

export type MessageTurnProps = ComponentProps<"div">;

const MessageTurn = (props: MessageTurnProps) => <div data-slot="message-turn" {...props} />;

export type MessageContentProps = ComponentProps<"div">;

const MessageContent = (props: MessageContentProps) => (
  <div data-slot="message-content" {...props} />
);

export type MessageActionsProps = ComponentProps<"div">;

const MessageActions = (props: MessageActionsProps) => (
  <div data-slot="message-actions" {...props} />
);

export type MessageAttachmentsProps = ComponentProps<"div">;

const MessageAttachments = (props: MessageAttachmentsProps) => (
  <div data-slot="message-attachments" {...props} />
);

export type MessageErrorProps = ComponentProps<"div">;

const MessageError = (props: MessageErrorProps) => <div data-slot="message-error" {...props} />;

export type MessageStoppedProps = ComponentProps<"div">;

const MessageStopped = (props: MessageStoppedProps) => (
  <div data-slot="message-stopped" {...props} />
);

export type MessageLoadingProps = ComponentProps<"div">;

const MessageLoading = (props: MessageLoadingProps) => (
  <div data-slot="message-loading" {...props} />
);

export type MessageSourcesProps = ComponentProps<"div">;

const MessageSources = (props: MessageSourcesProps) => (
  <div data-slot="message-sources" {...props} />
);

export type MessageSourceProps = ComponentProps<"a"> & {
  url: string;
};

const MessageSource = ({ url, ...props }: MessageSourceProps) => (
  // biome-ignore lint/a11y/useAnchorContent: content comes from the styled layer
  <a data-slot="message-source" href={url} target="_blank" rel="noopener noreferrer" {...props} />
);

// ---------------------------------------------------------------------------
// Timestamp
// ---------------------------------------------------------------------------

export type MessageTimestampProps = ComponentProps<"span"> & {
  timestamp: Date | string | number;
};

const MessageTimestamp = ({ timestamp, children, ...props }: MessageTimestampProps) => {
  const date = new Date(timestamp);
  const formattedTime = date.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });

  return (
    <span data-slot="message-timestamp" {...props}>
      {children ?? formattedTime}
    </span>
  );
};

// ---------------------------------------------------------------------------
// Text — parses inline chip tokens; the styled layer supplies renderers for
// text runs (e.g. markdown) and chips (styled Chip). Defaults render plainly.
// ---------------------------------------------------------------------------

export type MessageChipSegment = Extract<ChipSegment, { type: "chip" }>;

export type MessageTextProps = {
  children: string;
  className?: string;
  renderText?: (text: string, index: number) => ReactNode;
  renderChip?: (chip: MessageChipSegment, index: number) => ReactNode;
};

const MessageText = ({ children, className, renderText, renderChip }: MessageTextProps) => {
  const segments = parseChipSegments(children);

  return (
    <span data-slot="message-text" className={className}>
      {segments.map((segment, index) =>
        segment.type === "text" ? (
          <Fragment key={index}>
            {renderText ? renderText(segment.text, index) : segment.text}
          </Fragment>
        ) : (
          <Fragment key={index}>
            {renderChip ? (
              renderChip(segment, index)
            ) : (
              <span data-slot="message-chip">{segment.label}</span>
            )}
          </Fragment>
        ),
      )}
    </span>
  );
};

// ---------------------------------------------------------------------------
// Selection subsystem — scoped text-selection detection for a message's
// content. The styled layer anchors its own floating toolbar to the returned
// live Range.
// ---------------------------------------------------------------------------

export type MessageSelection = {
  text: string;
  range: Range;
};

export const readMessageSelection = (scope: HTMLElement): MessageSelection | null => {
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
export const useMessageSelection = (scope: HTMLElement | null): MessageSelection | null => {
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

/**
 * Resolves the owning message's content element from an invisible anchor node
 * rendered anywhere inside the message. Scoping to message-content keeps the
 * toolbar off markers, sources, and actions elsewhere in the message.
 */
export const useMessageSelectionScope = () => {
  const [contentElement, setContentElement] = useState<HTMLElement | null>(null);

  const anchorRef = useCallback((node: HTMLElement | null) => {
    const messageRoot = node?.closest<HTMLElement>('[data-slot="message"]');
    setContentElement(
      messageRoot?.querySelector<HTMLElement>('[data-slot="message-content"]') ?? null,
    );
  }, []);

  return { anchorRef, contentElement };
};

// ---------------------------------------------------------------------------
// Compound export
// ---------------------------------------------------------------------------

export const Message = Object.assign(MessageRoot, {
  Turn: MessageTurn,
  Content: MessageContent,
  Actions: MessageActions,
  Attachments: MessageAttachments,
  Text: MessageText,
  Error: MessageError,
  Stopped: MessageStopped,
  Loading: MessageLoading,
  Timestamp: MessageTimestamp,
  Sources: MessageSources,
  Source: MessageSource,
});
