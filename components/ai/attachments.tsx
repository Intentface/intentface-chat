"use client";

import type { AttachmentErrorCode, AttachmentItem } from "@intentface/chat/attachments";
import { PaperclipIcon } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import Image from "next/image";
import type { ComponentProps, ReactNode } from "react";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { IconButton } from "@/components/ui/icon-button";
import { formatFileSize, isImageAttachment, isPdfAttachment } from "@/lib/ai/attachments";
import { cn } from "@/lib/utils";
import { CrossMediumIcon } from "../icons/cross-medium";
import { FileBendIcon } from "../icons/file-bend";
import { PaperClipIcon } from "../icons/paperclip";

// Re-export the attachment surface so consumers import everything from this
// module: the generic mechanics from the headless package, and this app's
// policy/taxonomy/send strategy from the app helpers.
export {
  type AttachmentErrorCode,
  type AttachmentItem,
  matchesAccept,
  revokeAllAttachmentUrls,
  revokeAttachmentUrl,
  toAttachmentItem,
} from "@intentface/chat/attachments";
export {
  ATTACHMENT_ACCEPT,
  ATTACHMENT_MAX_FILE_SIZE,
  ATTACHMENT_MAX_FILES,
  formatFileSize,
  isImageAttachment,
  isPdfAttachment,
  prepareAttachmentsForSend,
} from "@/lib/ai/attachments";

type AttachmentsRootProps = {
  children: ReactNode;
  className?: string;
  show?: boolean;
};

const AttachmentsRoot = ({ children, className, show = true }: AttachmentsRootProps) => (
  <AnimatePresence initial={false}>
    {show && (
      <motion.div
        initial={{ height: 0, opacity: 0 }}
        animate={{ height: "auto", opacity: 1 }}
        exit={{ height: 0, opacity: 0 }}
        transition={{ duration: 0.2, ease: "easeOut" }}
        className="overflow-hidden"
      >
        <div data-slot="attachments" className={cn("flex flex-wrap gap-2 px-2 pt-2", className)}>
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
  if (isPdfAttachment(mediaType)) return FileBendIcon;
  return PaperclipIcon;
};

const AttachmentsItem = ({ item, children, className }: AttachmentsItemProps) => {
  const mediaType = item.mediaType ?? "";
  const filename = item.filename ?? "Attachment";
  const Icon = getFileIcon(mediaType);
  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.8 }}
      transition={{
        duration: 0.15,
        layout: { duration: 0.2, ease: "easeOut" },
      }}
      data-slot="attachments-item"
      data-media-type={
        isImageAttachment(mediaType) ? "image" : isPdfAttachment(mediaType) ? "pdf" : "file"
      }
      className={cn(
        "group relative flex h-12 max-w-48 items-center gap-2 rounded-lg border border-secondary-border bg-secondary-bg px-2",
        className,
      )}
    >
      {isImageAttachment(mediaType) ? (
        <Image
          width={32}
          height={32}
          alt={filename}
          className="size-8 shrink-0 rounded-xs object-cover ring-1 ring-inset ring-slate-7/10"
          src={item.url}
        />
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
        {item.fileSize != null && (
          <span className="text-2xs text-muted-foreground">{formatFileSize(item.fileSize)}</span>
        )}
      </div>
      {children}
    </motion.div>
  );
};

type AttachmentsRemoveProps = {
  onRemove: () => void;
  filename?: string;
  className?: string;
};

const AttachmentsRemove = ({ onRemove, filename, className }: AttachmentsRemoveProps) => (
  <IconButton
    aria-label={filename ? `Remove ${filename}` : "Remove attachment"}
    className={cn(
      "absolute -top-1.5 -right-1.5 rounded-full  opacity-0 transition-opacity group-hover:opacity-100",
      className,
    )}
    onClick={onRemove}
    size="2xs"
    type="button"
  >
    <CrossMediumIcon className="size-3" />
  </IconButton>
);

type AttachmentsDropzoneProps = {
  visible?: boolean;
  variant?: "inline" | "global";
  children?: ReactNode;
  className?: string;
};

const dropzoneVariants = {
  inline:
    "absolute inset-0 m-1 flex items-center justify-center rounded-xl border border-dashed border-secondary-border bg-secondary-bg",
  global:
    "absolute inset-0 z-50 flex items-center justify-center rounded-[inherit] border-2 border-dashed border-secondary-border bg-secondary-bg/80 backdrop-blur-xs",
};

const GLOBAL_DROPZONE_SELECTOR = '[data-slot="sidebar-inset"]';

const AttachmentsDropzone = ({
  visible: show = false,
  variant = "inline",
  children,
  className,
}: AttachmentsDropzoneProps) => {
  const [portalTarget, setPortalTarget] = useState<Element | null>(null);

  useEffect(() => {
    if (variant !== "global") return;
    setPortalTarget(document.querySelector(GLOBAL_DROPZONE_SELECTOR));
  }, [variant]);

  const content = (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15, ease: "easeOut" }}
          data-slot="attachments-dropzone"
          className={cn(dropzoneVariants[variant], className)}
        >
          {children ?? <span className="text-sm font-medium">Drop files here</span>}
        </motion.div>
      )}
    </AnimatePresence>
  );

  if (portalTarget) return createPortal(content, portalTarget);
  return content;
};

// This app's copy for the machine's structured validation codes.
const ERROR_COPY: Record<AttachmentErrorCode, string> = {
  accept: "No files match the accepted types.",
  max_file_size: "All files exceed the maximum size.",
  max_files: "Too many files. Some were not added.",
};

type AttachmentsErrorProps = {
  code?: AttachmentErrorCode | null;
  className?: string;
  children?: ReactNode;
};

const AttachmentsError = ({ code, className, children }: AttachmentsErrorProps) => {
  const content = children ?? (code ? ERROR_COPY[code] : null);
  if (!content) return null;
  return (
    <span
      role="alert"
      data-slot="attachments-error"
      className={cn("text-xs text-red-500", className)}
    >
      {content}
    </span>
  );
};

type AttachmentsTriggerProps = ComponentProps<typeof IconButton>;

const AttachmentsTrigger = ({ children, className, ...props }: AttachmentsTriggerProps) => {
  return (
    <IconButton type="button" variant="ghost" aria-label="Add attachment" {...props}>
      {children ?? <PaperClipIcon />}
    </IconButton>
  );
};

export const Attachments = Object.assign(AttachmentsRoot, {
  Dropzone: AttachmentsDropzone,
  Item: AttachmentsItem,
  Remove: AttachmentsRemove,
  Error: AttachmentsError,
  Trigger: AttachmentsTrigger,
});
