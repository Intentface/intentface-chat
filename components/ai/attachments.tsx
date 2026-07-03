"use client";

import {
  type AttachmentItem,
  formatFileSize,
  isImageAttachment,
  isPdfAttachment,
} from "@intentface/chat/attachments";
import { FileIcon, PaperclipIcon, XIcon } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import Image from "next/image";
import type { ComponentProps, ReactNode } from "react";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { IconButton } from "@/components/ui/icon-button";
import { cn } from "@/lib/utils";
import { PaperClipIcon } from "../icons/paperclip";

// The attachment logic (types, accept matching, blob-URL lifecycle, send
// preparation) lives in the headless package; re-export it so consumers keep
// importing everything from this module.
export {
  type AttachmentError,
  type AttachmentErrorCode,
  type AttachmentItem,
  DEFAULT_ATTACHMENT_ACCEPT,
  DEFAULT_ATTACHMENT_MAX_FILE_SIZE,
  DEFAULT_ATTACHMENT_MAX_FILES,
  matchesAccept,
  prepareAttachmentsForSend,
  revokeAllAttachmentUrls,
  revokeAttachmentUrl,
  toAttachmentItem,
} from "@intentface/chat/attachments";

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
  if (isPdfAttachment(mediaType)) return FileIcon;
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
        "group relative flex h-12 max-w-48 items-center gap-2 rounded-lg border border-secondary-border bg-secondary px-2",
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
        <div className="flex size-10 shrink-0 items-center justify-center rounded-md bg-primary-hover">
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
  className?: string;
};

const AttachmentsRemove = ({ onRemove, className }: AttachmentsRemoveProps) => (
  <IconButton
    aria-label="Remove attachment"
    className={cn(
      "absolute -top-1.5 -right-1.5 rounded-full  opacity-0 transition-opacity group-hover:opacity-100",
      className,
    )}
    onClick={onRemove}
    size="2xs"
    type="button"
  >
    <XIcon className="size-3" />
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
    "absolute inset-0 m-1 flex items-center justify-center rounded-xl border border-dashed border-secondary-border bg-secondary",
  global:
    "absolute inset-0 z-50 flex items-center justify-center rounded-[inherit] border-2 border-dashed border-secondary-border bg-secondary/80 backdrop-blur-xs",
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

type AttachmentsErrorProps = {
  className?: string;
};

const AttachmentsError = ({ className, ...props }: AttachmentsErrorProps) => (
  <span
    data-slot="attachments-error"
    className={cn("text-xs text-red-500", className)}
    {...props}
  />
);

type AttachmentsTriggerProps = ComponentProps<typeof IconButton>;

const AttachmentsTrigger = ({ children, className, ...props }: AttachmentsTriggerProps) => {
  return (
    <IconButton type="button" variant="ghost" {...props}>
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
