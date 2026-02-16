"use client";

import { FileIcon, PaperclipIcon, XIcon } from "lucide-react";
import { IconButton } from "@/components/ui/icon-button";
import { cn } from "@/lib/utils";
import type { AttachmentItem } from "./prompt-input-attachments";

type AttachmentsInlineProps = {
  attachments: AttachmentItem[];
  onRemove: (id: string) => void;
  className?: string;
};

const isImage = (mediaType: string) => mediaType.startsWith("image/");

const isPdf = (mediaType: string) => mediaType === "application/pdf";

export const AttachmentsInline = ({
  attachments,
  onRemove,
  className,
}: AttachmentsInlineProps) => {
  if (attachments.length === 0) {
    return null;
  }

  return (
    <div className={cn("flex flex-wrap gap-2 px-2 pt-2", className)}>
      {attachments.map((attachment) => {
        const mediaType = attachment.mediaType ?? "";

        return (
          <div
            className="group relative flex h-16 w-24 overflow-hidden rounded-md border bg-muted"
            key={attachment.id}
          >
            {isImage(mediaType) ? (
              <img
                alt={attachment.filename ?? "Attachment"}
                className="h-full w-full object-cover"
                src={attachment.url}
              />
            ) : (
              <div className="flex h-full w-full flex-col items-center justify-center gap-1 p-1 text-muted-foreground">
                {isPdf(mediaType) ? (
                  <FileIcon className="size-4" />
                ) : (
                  <PaperclipIcon className="size-4" />
                )}
                <span className="line-clamp-1 w-full text-center text-[10px]">
                  {attachment.filename ?? (isPdf(mediaType) ? "PDF" : "File")}
                </span>
              </div>
            )}

            <IconButton
              aria-label={`Remove ${attachment.filename ?? "attachment"}`}
              className="absolute top-1 right-1 opacity-0 transition-opacity group-hover:opacity-100"
              onClick={() => onRemove(attachment.id)}
              size="xs"
              type="button"
              variant="secondary"
            >
              <XIcon className="size-3" />
            </IconButton>
          </div>
        );
      })}
    </div>
  );
};
