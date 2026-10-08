"use client";

import {
  type AttachmentErrorCode,
  type AttachmentItem,
  Attachments,
  matchesAccept,
  revokeAttachmentUrl,
  toAttachmentItem,
} from "@intentface/chat/attachments";
import { X } from "@keyline-icons/react";
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

  // Blob URLs outlive the component unless something revokes them: a removed
  // item's on removal, and whatever is still minted when the demo unmounts.
  const minted = useRef(new Set<AttachmentItem>());
  useEffect(() => {
    const live = minted.current;
    return () => live.forEach(revokeAttachmentUrl);
  }, []);

  const add = (files: FileList | null) => {
    if (!files?.length) return;
    setError(null);

    for (const file of Array.from(files)) {
      if (!matchesAccept(file, ACCEPT)) return setError("accept");
      if (file.size > MAX_BYTES) return setError("max_file_size");
      const item = toAttachmentItem(file);
      minted.current.add(item);
      setItems((current) => [...current, item]);
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
      className="relative flex w-full max-w-lg flex-col gap-3 rounded-xl border border-zinc-950/15 border-dashed bg-zinc-950/[0.02] p-3 has-data-[visible]:border-[#0169cc]/60 has-data-[visible]:bg-[#0169cc]/5 dark:border-white/15 dark:bg-white/[0.03] dark:has-data-[visible]:border-[#4c9bea]/60 dark:has-data-[visible]:bg-[#4c9bea]/10"
    >
      <Attachments.Dropzone
        visible={dragging}
        className="pointer-events-none absolute inset-0 z-10 hidden place-items-center rounded-[11px] bg-white/80 font-medium text-[#0169cc] text-[13px] data-[visible]:grid dark:bg-zinc-900/80 dark:text-[#4c9bea]"
      >
        Drop to attach
      </Attachments.Dropzone>

      {items.length > 0 && (
        <Attachments.Root className="flex flex-wrap gap-1.5">
          {items.map((item) => (
            <Attachments.Item
              key={item.id}
              className={`group/item flex h-6 items-center gap-1.5 rounded-[7px] px-2 font-medium text-xs text-zinc-900 dark:text-zinc-100 ${RAISED}`}
            >
              <span className="max-w-40 truncate">{item.filename}</span>
              <Attachments.Remove
                filename={item.filename}
                onRemove={() => {
                  revokeAttachmentUrl(item);
                  minted.current.delete(item);
                  setItems((current) => current.filter((candidate) => candidate.id !== item.id));
                }}
                className="-mr-1 grid size-4 cursor-pointer place-items-center rounded-full text-zinc-400 opacity-0 transition-opacity hover:text-zinc-900 focus-visible:opacity-100 group-hover/item:opacity-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0169cc]/60 dark:text-zinc-500 dark:hover:text-zinc-100"
              >
                <X className="size-[11px]" />
              </Attachments.Remove>
            </Attachments.Item>
          ))}
        </Attachments.Root>
      )}

      <div className="flex items-center gap-3">
        <Attachments.Trigger
          onClick={() => input.current?.click()}
          className={`h-8 shrink-0 cursor-pointer rounded-full px-3.5 font-medium text-[13px] text-zinc-900 hover:from-[#fafafa] hover:to-[#f6f6f6] dark:hover:from-[#38383b] dark:hover:to-[#313134] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0169cc]/60 dark:text-zinc-100 ${RAISED}`}
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

        <span className="text-xs text-zinc-500 dark:text-zinc-400">
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

// The raised surface shared by each attachment chip and the picker button.
const RAISED =
  "bg-white bg-linear-to-b from-white to-[#fdfdfd] shadow-[inset_0_1px_0_#fff,0_0_0_1px_rgb(0_0_0/0.075),0_1px_2px_rgb(0_0_0/0.07),0_2px_6px_-2px_rgb(0_0_0/0.05)] dark:bg-[#2d2d30] dark:from-[#313134] dark:to-[#2a2a2d] dark:shadow-[inset_0_1px_0_rgb(255_255_255/0.1),inset_0_0_0_1px_rgb(255_255_255/0.05),0_0_0_1px_rgb(0_0_0/0.16),0_1px_2px_rgb(0_0_0/0.1)]";
