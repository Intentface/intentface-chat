"use client";

// Headless attachments: the file-handling logic (accept matching, blob-URL
// lifecycle, send preparation) plus unstyled structural parts. Card visuals,
// icons, thumbnails, and enter/exit animation belong to the styled layer.

import { nanoid } from "nanoid";
import { type ReactNode, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import type { PrimitiveProps } from "./internal/primitive-props";
import type { StateAttributesMapping } from "./internal/render/getStateAttributesProps";
import { useRenderElement } from "./internal/render/useRenderElement";
import type { FilePart } from "./types";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type AttachmentItem = FilePart & { id: string; fileSize?: number };

export type AttachmentErrorCode = "accept" | "max_file_size" | "max_files";

export type AttachmentError = {
  code: AttachmentErrorCode;
  message: string;
};

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

export const DEFAULT_ATTACHMENT_ACCEPT = "image/*,application/pdf,text/*";
export const DEFAULT_ATTACHMENT_MAX_FILES = 5;
export const DEFAULT_ATTACHMENT_MAX_FILE_SIZE = 10 * 1024 * 1024;

// ---------------------------------------------------------------------------
// Utilities
// ---------------------------------------------------------------------------

export const matchesAccept = (file: File, accept: string): boolean => {
  if (!accept || accept.trim() === "") {
    return true;
  }

  const patterns = accept
    .split(",")
    .map((pattern) => pattern.trim())
    .filter(Boolean);

  return patterns.some((pattern) => {
    if (pattern.endsWith("/*")) {
      const prefix = pattern.slice(0, -1);
      return file.type.startsWith(prefix);
    }
    return file.type === pattern;
  });
};

export const toAttachmentItem = (file: File): AttachmentItem => ({
  filename: file.name,
  fileSize: file.size,
  id: nanoid(),
  mediaType: file.type,
  type: "file",
  url: URL.createObjectURL(file),
});

export const revokeAttachmentUrl = (item: Pick<AttachmentItem, "url">) => {
  if (item.url?.startsWith("blob:")) {
    URL.revokeObjectURL(item.url);
  }
};

export const revokeAllAttachmentUrls = (items: AttachmentItem[]) => {
  for (const item of items) {
    revokeAttachmentUrl(item);
  }
};

const convertBlobUrlToDataUrl = async (url: string): Promise<string | null> => {
  try {
    const response = await fetch(url);
    const blob = await response.blob();

    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
};

export const prepareAttachmentsForSend = async (
  attachments: AttachmentItem[],
): Promise<FilePart[]> => {
  return Promise.all(
    attachments.map(async ({ id: _id, ...attachment }) => {
      if (attachment.url.startsWith("blob:")) {
        const converted = await convertBlobUrlToDataUrl(attachment.url);
        return {
          ...attachment,
          url: converted ?? attachment.url,
        };
      }

      return attachment;
    }),
  );
};

export const isImageAttachment = (mediaType: string) => mediaType.startsWith("image/");

export const isPdfAttachment = (mediaType: string) => mediaType === "application/pdf";

export const formatFileSize = (bytes: number): string => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

// ---------------------------------------------------------------------------
// Structural parts
// ---------------------------------------------------------------------------

export type AttachmentsRootProps = PrimitiveProps<"div">;

const AttachmentsRoot = ({ className, render, style, ...elementProps }: AttachmentsRootProps) =>
  useRenderElement(
    "div",
    { className, render, style },
    { props: [{ "data-slot": "attachments" }, elementProps] },
  );

export type AttachmentsItemState = {
  /** The item's media category, surfaced as data-media-type. */
  mediaType: "image" | "pdf" | "file";
};

const attachmentsItemStateMapping: StateAttributesMapping<AttachmentsItemState> = {
  mediaType: (value): Record<string, string> => ({ "data-media-type": value }),
};

export type AttachmentsItemProps = PrimitiveProps<"div", AttachmentsItemState> & {
  item: AttachmentItem;
};

const AttachmentsItem = ({
  item,
  className,
  render,
  style,
  ...elementProps
}: AttachmentsItemProps) => {
  const mediaType = isImageAttachment(item.mediaType ?? "")
    ? "image"
    : isPdfAttachment(item.mediaType ?? "")
      ? "pdf"
      : "file";

  return useRenderElement(
    "div",
    { className, render, style },
    {
      state: { mediaType },
      stateAttributesMapping: attachmentsItemStateMapping,
      props: [{ "data-slot": "attachments-item" }, elementProps],
    },
  );
};

export type AttachmentsRemoveProps = PrimitiveProps<"button"> & {
  onRemove: () => void;
};

const AttachmentsRemove = ({
  onRemove,
  className,
  render,
  style,
  ...elementProps
}: AttachmentsRemoveProps) =>
  useRenderElement(
    "button",
    { className, render, style },
    {
      props: [
        {
          "aria-label": "Remove attachment",
          "data-slot": "attachments-remove",
          onClick: onRemove,
        },
        elementProps,
      ],
    },
  );

export type AttachmentsDropzoneState = {
  /** Present as data-visible while files are dragged over the scope. */
  visible: boolean;
};

export type AttachmentsDropzoneProps = PrimitiveProps<"div", AttachmentsDropzoneState> & {
  visible?: boolean;
  /** Keep the dropzone mounted (hidden) when not visible. */
  keepMounted?: boolean;
  /** CSS selector to portal the dropzone into (e.g. an app shell region). */
  portalSelector?: string;
  children?: ReactNode;
};

const AttachmentsDropzone = ({
  visible = false,
  keepMounted = false,
  portalSelector,
  children,
  className,
  render,
  style,
  ...elementProps
}: AttachmentsDropzoneProps) => {
  const [portalTarget, setPortalTarget] = useState<Element | null>(null);

  useEffect(() => {
    if (!portalSelector) return;
    setPortalTarget(document.querySelector(portalSelector));
  }, [portalSelector]);

  const content = useRenderElement(
    "div",
    { className, render, style },
    {
      enabled: visible || keepMounted,
      state: { visible },
      props: [
        { "data-slot": "attachments-dropzone", children: children ?? <span>Drop files here</span> },
        elementProps,
      ],
    },
  );

  if (!content) return null;
  if (portalTarget) return createPortal(content, portalTarget);
  return content;
};

export type AttachmentsErrorProps = PrimitiveProps<"span">;

const AttachmentsError = ({ className, render, style, ...elementProps }: AttachmentsErrorProps) =>
  useRenderElement(
    "span",
    { className, render, style },
    { props: [{ "data-slot": "attachments-error" }, elementProps] },
  );

export type AttachmentsTriggerProps = PrimitiveProps<"button">;

const AttachmentsTrigger = ({
  className,
  render,
  style,
  ...elementProps
}: AttachmentsTriggerProps) =>
  useRenderElement(
    "button",
    { className, render, style },
    { props: [{ "data-slot": "attachments-trigger" }, elementProps] },
  );

export const Attachments = Object.assign(AttachmentsRoot, {
  Dropzone: AttachmentsDropzone,
  Item: AttachmentsItem,
  Remove: AttachmentsRemove,
  Error: AttachmentsError,
  Trigger: AttachmentsTrigger,
});
