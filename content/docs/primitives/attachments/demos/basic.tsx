"use client";

import { type AttachmentItem, Attachments } from "@intentface/chat/attachments";
import { File, X } from "@keyline-icons/react";
import { useState } from "react";

// A removable strip driven by local state — the parts are structural slots and
// impose no media taxonomy, so icons and layout are yours to decide.
const INITIAL: AttachmentItem[] = [
  {
    id: "1",
    filename: "quarterly-report.pdf",
    mediaType: "application/pdf",
    url: "#",
    fileSize: 248_000,
  },
  { id: "2", filename: "meeting-notes.txt", mediaType: "text/plain", url: "#", fileSize: 1_200 },
];

export const Basic = () => {
  const [items, setItems] = useState<AttachmentItem[]>(INITIAL);

  if (items.length === 0) {
    return (
      <button
        type="button"
        onClick={() => setItems(INITIAL)}
        className={`h-8 cursor-pointer rounded-full px-3.5 font-medium text-[13px] text-zinc-900 hover:from-[#fafafa] hover:to-[#f6f6f6] dark:hover:from-[#38383b] dark:hover:to-[#313134] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0169cc]/60 dark:text-zinc-100 ${RAISED}`}
      >
        Reset
      </button>
    );
  }

  return (
    <Attachments.Root className="flex w-full max-w-md flex-wrap gap-1.5">
      {items.map((item) => (
        <Attachments.Item
          key={item.id}
          className={`flex h-6 items-center gap-1.5 rounded-[7px] pr-2 pl-1.5 ${RAISED}`}
        >
          <File className="size-3.5 shrink-0 text-zinc-500 dark:text-zinc-400" />
          <span className="max-w-40 truncate font-medium text-xs text-zinc-900 dark:text-zinc-100">
            {item.filename}
          </span>
          <span className="font-mono text-[11px] text-zinc-400 dark:text-zinc-500">
            {formatFileSize(item.fileSize)}
          </span>
          <Attachments.Remove
            onRemove={() => setItems((current) => current.filter((it) => it.id !== item.id))}
            filename={item.filename}
            className="-mr-1 flex size-4 cursor-pointer items-center justify-center rounded-full text-zinc-400 transition-colors hover:bg-zinc-950/5 hover:text-zinc-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0169cc]/60 dark:text-zinc-500 dark:hover:bg-white/8 dark:hover:text-zinc-100"
          >
            <X className="size-[11px]" />
          </Attachments.Remove>
        </Attachments.Item>
      ))}
    </Attachments.Root>
  );
};

const formatFileSize = (bytes?: number) => {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

// The raised surface shared by the reset button and each attachment chip.
const RAISED =
  "bg-white bg-linear-to-b from-white to-[#fdfdfd] shadow-[inset_0_1px_0_#fff,0_0_0_1px_rgb(0_0_0/0.075),0_1px_2px_rgb(0_0_0/0.07),0_2px_6px_-2px_rgb(0_0_0/0.05)] dark:bg-[#2d2d30] dark:from-[#313134] dark:to-[#2a2a2d] dark:shadow-[inset_0_1px_0_rgb(255_255_255/0.1),inset_0_0_0_1px_rgb(255_255_255/0.05),0_0_0_1px_rgb(0_0_0/0.16),0_1px_2px_rgb(0_0_0/0.1)]";
