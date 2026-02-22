"use client";

import type { FileUIPart } from "ai";
import { FileIcon, PaperclipIcon, XIcon } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { nanoid } from "nanoid";
import type { ComponentProps, ReactNode } from "react";
import { IconButton } from "@/components/ui/icon-button";
import { cn } from "@/lib/utils";
import { PaperClipIcon } from "../icons/paperclip";

// Types
export type AttachmentItem = FileUIPart & { id: string };

export type AttachmentErrorCode = "accept" | "max_file_size" | "max_files";

export interface AttachmentError {
  code: AttachmentErrorCode;
  message: string;
}

// Constants
export const DEFAULT_ATTACHMENT_ACCEPT = "image/*,application/pdf,text/*";
export const DEFAULT_ATTACHMENT_MAX_FILES = 5;
export const DEFAULT_ATTACHMENT_MAX_FILE_SIZE = 10 * 1024 * 1024;

// Utilities

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
): Promise<FileUIPart[]> => {
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

// Display components

const isImage = (mediaType: string) => mediaType.startsWith("image/");

const isPdf = (mediaType: string) => mediaType === "application/pdf";

type AttachmentsRootProps = {
  children: ReactNode;
  className?: string;
  show?: boolean;
};

const AttachmentsRoot = ({
  children,
  className,
  show = true,
}: AttachmentsRootProps) => (
  <AnimatePresence initial={false}>
    {show && (
      <motion.div
        initial={{ height: 0, opacity: 0 }}
        animate={{ height: "auto", opacity: 1 }}
        exit={{ height: 0, opacity: 0 }}
        transition={{ duration: 0.2, ease: "easeOut" }}
        className="overflow-hidden"
      >
        <div className={cn("flex flex-wrap gap-2 px-2 pt-2", className)}>
          <AnimatePresence initial={false}>{children}</AnimatePresence>
        </div>
      </motion.div>
    )}
  </AnimatePresence>
);

type AttachmentsItemProps = {
  item: AttachmentItem;
  index?: number;
  children?: ReactNode;
  className?: string;
};

const getFileIcon = (mediaType: string) => {
  if (isPdf(mediaType)) return FileIcon;
  return PaperclipIcon;
};

const AttachmentsItem = ({
  item,
  index = 0,
  children,
  className,
}: AttachmentsItemProps) => {
  const mediaType = item.mediaType ?? "";
  const filename = item.filename ?? (isPdf(mediaType) ? "PDF" : "File");
  const Icon = getFileIcon(mediaType);
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.8 }}
      transition={{ duration: 0.15, delay: index * 0.05 }}
      className={cn(
        "group relative flex h-12 max-w-48 items-center gap-2 overflow-hidden rounded-lg border bg-slate-2 px-2",
        className,
      )}
    >
      {isImage(mediaType) ? (
        <img
          alt={filename}
          className="size-8 shrink-0 rounded-xs object-cover"
          src={item.url}
        />
      ) : (
        <div className="flex size-10 shrink-0 items-center justify-center rounded-md bg-slate-4">
          <Icon className="size-4 text-muted-foreground" />
        </div>
      )}
      <span className="flex min-w-0 text-xs font-medium">
        <span className="truncate">{filename.slice(0, -7)}</span>
        <span className="shrink-0">{filename.slice(-7)}</span>
      </span>
      {children}
    </motion.div>
  );
};

type AttachmentsRemoveProps = {
  onRemove: () => void;
  className?: string;
};

const AttachmentsRemove = ({ onRemove, className }: AttachmentsRemoveProps) => (
  <div
    className={cn(
      "absolute top-0 right-0 bottom-0 flex items-center justify-end px-2 w-16 bg-linear-to-r from-transparent to-slate-2 opacity-0 transition-opacity group-hover:opacity-100",
      className,
    )}
  >
    <IconButton
      aria-label="Remove attachment"
      className="relative"
      onClick={onRemove}
      size="xs"
      type="button"
    >
      <XIcon className="size-3" />
    </IconButton>
  </div>
);

type AttachmentsErrorProps = {
  className?: string;
};

const AttachmentsError = ({ className, ...props }: AttachmentsErrorProps) => (
  <span className={cn("text-xs text-red-500", className)} {...props} />
);

type AttachmentsTriggerProps = ComponentProps<typeof IconButton>;

const AttachmentsTrigger = ({
  children,
  className,
  ...props
}: AttachmentsTriggerProps) => {
  return (
    <IconButton type="button" variant="ghost" {...props}>
      {children ?? <PaperClipIcon />}
    </IconButton>
  );
};

export const Attachments = Object.assign(AttachmentsRoot, {
  Item: AttachmentsItem,
  Remove: AttachmentsRemove,
  Error: AttachmentsError,
  Trigger: AttachmentsTrigger,
});
