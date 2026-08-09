"use client";

import { type AttachmentItem, Attachments } from "@intentface/chat/attachments";
import { type ComponentProps, useState } from "react";

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
        className="cursor-pointer rounded-full border border-[#f0f0f0] bg-white px-4 py-1.5 text-sm font-medium text-[#686868] transition-colors hover:bg-[#fafafa] dark:border-[#262626] dark:bg-[#181818] dark:text-[#9b9b9b] dark:hover:bg-[#232323]"
      >
        Reset
      </button>
    );
  }

  return (
    <Attachments.Root className="flex w-full max-w-md flex-wrap gap-2">
      {items.map((item) => (
        <Attachments.Item
          key={item.id}
          className="flex items-center gap-2 rounded-xl border border-[#f0f0f0] bg-white py-1.5 pr-1.5 pl-2.5 text-xs dark:border-[#262626] dark:bg-[#181818]"
        >
          <FileIcon className="text-[#949494]" />
          <span className="max-w-40 truncate">{item.filename}</span>
          <span className="text-[#949494] dark:text-[#6f6f6f]">
            {formatFileSize(item.fileSize)}
          </span>
          <Attachments.Remove
            onRemove={() => setItems((current) => current.filter((it) => it.id !== item.id))}
            filename={item.filename}
            className="flex size-5 cursor-pointer items-center justify-center rounded-full text-[#949494] transition-colors hover:bg-[#f4f4f4] hover:text-[#1a1a1a] dark:hover:bg-[#232323] dark:hover:text-[#fcfcfc]"
          >
            <CrossIcon />
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

const FileIcon = (props: ComponentProps<"svg">) => (
  <svg
    width="14"
    height="14"
    viewBox="0 0 16 16"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.5"
    strokeLinejoin="round"
    aria-hidden="true"
    {...props}
  >
    <path d="M9 1.5H4.5A1.5 1.5 0 0 0 3 3v10a1.5 1.5 0 0 0 1.5 1.5h7A1.5 1.5 0 0 0 13 13V5.5L9 1.5Z" />
    <path d="M9 1.5v4h4" />
  </svg>
);

const CrossIcon = (props: ComponentProps<"svg">) => (
  <svg
    width="12"
    height="12"
    viewBox="0 0 16 16"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.5"
    strokeLinecap="round"
    aria-hidden="true"
    {...props}
  >
    <path d="m4.5 4.5 7 7m-7 0 7-7" />
  </svg>
);
