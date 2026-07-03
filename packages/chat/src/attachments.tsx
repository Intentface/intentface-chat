"use client";

// Headless attachments: the file-handling logic (accept matching, blob-URL
// lifecycle, send preparation) plus unstyled structural parts. Card visuals,
// icons, thumbnails, and enter/exit animation belong to the styled layer.

import { nanoid } from "nanoid";
import { type ComponentProps, type ReactNode, useEffect, useState } from "react";
import { createPortal } from "react-dom";
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

export type AttachmentsRootProps = ComponentProps<"div">;

const AttachmentsRoot = (props: AttachmentsRootProps) => <div data-slot="attachments" {...props} />;

export type AttachmentsItemProps = ComponentProps<"div"> & {
  item: AttachmentItem;
};

const AttachmentsItem = ({ item, ...props }: AttachmentsItemProps) => (
  <div
    data-slot="attachments-item"
    data-media-type={
      isImageAttachment(item.mediaType ?? "")
        ? "image"
        : isPdfAttachment(item.mediaType ?? "")
          ? "pdf"
          : "file"
    }
    {...props}
  />
);

export type AttachmentsRemoveProps = ComponentProps<"button"> & {
  onRemove: () => void;
};

const AttachmentsRemove = ({ onRemove, ...props }: AttachmentsRemoveProps) => (
  <button
    type="button"
    aria-label="Remove attachment"
    data-slot="attachments-remove"
    onClick={onRemove}
    {...props}
  />
);

export type AttachmentsDropzoneProps = ComponentProps<"div"> & {
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
  ...props
}: AttachmentsDropzoneProps) => {
  const [portalTarget, setPortalTarget] = useState<Element | null>(null);

  useEffect(() => {
    if (!portalSelector) return;
    setPortalTarget(document.querySelector(portalSelector));
  }, [portalSelector]);

  if (!visible && !keepMounted) return null;

  const content = (
    <div data-slot="attachments-dropzone" data-visible={visible || undefined} {...props}>
      {children ?? <span>Drop files here</span>}
    </div>
  );

  if (portalTarget) return createPortal(content, portalTarget);
  return content;
};

export type AttachmentsErrorProps = ComponentProps<"span">;

const AttachmentsError = (props: AttachmentsErrorProps) => (
  <span data-slot="attachments-error" {...props} />
);

export type AttachmentsTriggerProps = ComponentProps<"button">;

const AttachmentsTrigger = (props: AttachmentsTriggerProps) => (
  <button type="button" data-slot="attachments-trigger" {...props} />
);

export const Attachments = Object.assign(AttachmentsRoot, {
  Dropzone: AttachmentsDropzone,
  Item: AttachmentsItem,
  Remove: AttachmentsRemove,
  Error: AttachmentsError,
  Trigger: AttachmentsTrigger,
});
