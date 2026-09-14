"use client";

import {
  type AttachmentErrorCode,
  type AttachmentItem,
  Attachments,
  matchesAccept,
  revokeAttachmentUrl,
  toAttachmentItem,
} from "@intentface/chat/attachments";
import { IconX } from "@tabler/icons-react";
import { type DragEvent, useEffect, useRef, useState } from "react";

const ACCEPT = "image/*,.pdf";
const MAX_BYTES = 2 * 1024 * 1024;

/*
 * The whole intake path: drop a file on the panel, or pick one with the
 * button, and watch a rejected file land in the error slot.
 *
 * The package ships the mechanics and none of the policy. `matchesAccept` and
 * `toAttachmentItem` are plain functions you call where you like; what counts
 * as too large, and what the message says when something is rejected, are
 * decided here. Validation emits a *code*, never copy, so the wording below is
 * ours to localise.
 */
export const Dropzone = () => {
  const [items, setItems] = useState<AttachmentItem[]>([]);
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState<AttachmentErrorCode | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const depth = useRef(0);

  // Blob URLs outlive the component unless something revokes them.
  useEffect(() => () => items.forEach(revokeAttachmentUrl), [items]);

  const add = (files: FileList | null) => {
    if (!files?.length) return;
    setError(null);

    for (const file of Array.from(files)) {
      if (!matchesAccept(file, ACCEPT)) return setError("accept");
      if (file.size > MAX_BYTES) return setError("max_file_size");
      setItems((current) => [...current, toAttachmentItem(file)]);
    }
  };

  // dragenter/dragleave fire for every child element, so a bare boolean
  // flickers as the pointer crosses the tray. Counting depth does not.
  const onDragEnter = (event: DragEvent) => {
    event.preventDefault();
    depth.current += 1;
    setDragging(true);
  };
  const onDragLeave = () => {
    depth.current -= 1;
    if (depth.current <= 0) setDragging(false);
  };
  const onDrop = (event: DragEvent) => {
    event.preventDefault();
    depth.current = 0;
    setDragging(false);
    add(event.dataTransfer.files);
  };

  // A drop target is a pointer-only convenience, not a control. Giving it a role
  // would announce an affordance no keyboard user can reach; the picker button
  // below is the accessible route to the same thing.
  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: drop target, not a control
    <div
      onDragEnter={onDragEnter}
      onDragOver={(event) => event.preventDefault()}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      className="relative flex w-full max-w-lg flex-col gap-3 rounded-xl border border-[#f0f0f0] bg-white p-3 dark:border-[#262626] dark:bg-[#181818]"
    >
      <Attachments.Dropzone
        visible={dragging}
        className="pointer-events-none absolute inset-0 z-10 hidden place-items-center rounded-xl border-2 border-[#1a1a1a] border-dashed bg-white/80 font-medium text-[#1a1a1a] text-sm data-[visible]:grid dark:border-[#fcfcfc] dark:bg-[#181818]/80 dark:text-[#fcfcfc]"
      >
        Drop to attach
      </Attachments.Dropzone>

      {items.length > 0 && (
        <Attachments.Root className="flex flex-wrap gap-2">
          {items.map((item) => (
            <Attachments.Item
              key={item.id}
              className="group/item flex h-8 items-center gap-2 rounded-lg border border-[#f0f0f0] bg-[#fafafa] pr-1 pl-2.5 text-[#1a1a1a] text-xs dark:border-[#2d2d2d] dark:bg-[#232323] dark:text-[#fcfcfc]"
            >
              <span className="max-w-40 truncate">{item.filename}</span>
              <Attachments.Remove
                filename={item.filename}
                onRemove={() => {
                  revokeAttachmentUrl(item);
                  setItems((current) => current.filter((candidate) => candidate.id !== item.id));
                }}
                className="grid size-5 cursor-pointer place-items-center rounded text-[#949494] opacity-0 transition-opacity hover:text-[#1a1a1a] group-hover/item:opacity-100 dark:text-[#6f6f6f] dark:hover:text-[#fcfcfc]"
              >
                <IconX className="size-3.5" />
              </Attachments.Remove>
            </Attachments.Item>
          ))}
        </Attachments.Root>
      )}

      <div className="flex items-center gap-3">
        <Attachments.Trigger
          onClick={() => input.current?.click()}
          className="h-8 cursor-pointer rounded-full border border-[#e4e4e4] bg-white px-4 font-medium text-[#1a1a1a] text-sm transition-colors hover:bg-[#f4f4f4] dark:border-[#2d2d2d] dark:bg-[#181818] dark:text-[#fcfcfc] dark:hover:bg-[#232323]"
        >
          Add attachment
        </Attachments.Trigger>

        {/* The package owns no file input; this one is ours. */}
        <input
          ref={input}
          type="file"
          multiple
          accept={ACCEPT}
          onChange={(event) => {
            add(event.target.files);
            event.target.value = "";
          }}
          className="hidden"
        />

        <span className="text-[#949494] text-xs dark:text-[#6f6f6f]">
          Images and PDFs, up to 2 MB. Try a .txt to see a rejection.
        </span>
      </div>

      {/* A live region: whatever appears inside announces immediately. */}
      <Attachments.Error className="text-red-600 text-xs empty:hidden dark:text-red-400">
        {error === null ? null : MESSAGES[error]}
      </Attachments.Error>
    </div>
  );
};

/** Codes in, copy out — the only place wording lives. */
const MESSAGES: Record<AttachmentErrorCode, string> = {
  accept: "That file type is not accepted. Images and PDFs only.",
  max_file_size: "That file is larger than 2 MB.",
  max_files: "Too many files at once.",
};
