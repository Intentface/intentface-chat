"use client";

import { Attachments } from "@intentface/chat/attachments";
import { Composer, type ComposerSubmitData, useComposer } from "@intentface/chat/composer";
import { IconArrowUp, IconPaperclip, IconX } from "@tabler/icons-react";

// Composer.Attachments carries the policy and the hidden file input; the strip
// itself is yours. Files can be picked with the trigger or dropped on the composer.
export const AttachmentsDemo = () => {
  const handleSubmit = (data: ComposerSubmitData) => {
    if (data.kind === "message") {
      console.log(data.files);
    }
  };

  return (
    // Reserve height so the strip appearing grows the composer upward.
    <div className="flex min-h-[220px] w-full max-w-xl flex-col justify-end">
      <Composer.Root onSubmit={handleSubmit} className="flex flex-col">
        <Composer.Container className="cursor-text rounded-2xl border border-[#f0f0f0] bg-white shadow-xs transition-colors focus-within:border-[#ececec] dark:border-[#262626] dark:bg-[#181818] dark:focus-within:border-[#2d2d2d]">
          <Composer.Attachments accept="image/*,application/pdf" maxFiles={4}>
            <Strip />
          </Composer.Attachments>
          <Composer.Textarea className="max-h-32 min-h-8 overflow-y-auto px-4 pt-3 text-sm **:data-composer-editor:w-full **:data-composer-editor:max-w-none **:data-composer-editor:leading-[1.7] [&_[data-composer-editor]:focus]:outline-none">
            <Composer.Placeholder
              placeholder="Attach a file, or drag one in…"
              className="leading-[1.7] text-[#949494] dark:text-[#6f6f6f]"
            />
          </Composer.Textarea>
          <Composer.Actions className="flex items-center justify-end gap-1 p-2">
            <Composer.AttachmentTrigger
              aria-label="Attach a file"
              className="flex size-8 cursor-pointer items-center justify-center rounded-full text-[#949494] transition-colors hover:bg-[#f4f4f4] hover:text-[#1a1a1a] dark:text-[#6f6f6f] dark:hover:bg-[#232323] dark:hover:text-[#fcfcfc]"
            >
              <IconPaperclip className="size-4" />
            </Composer.AttachmentTrigger>
            <Composer.Submit className="flex size-8 items-center justify-center rounded-full bg-[#1a1a1a] text-white transition-opacity disabled:opacity-40 dark:bg-[#fcfcfc] dark:text-[#111111]">
              <IconArrowUp className="size-4" />
            </Composer.Submit>
          </Composer.Actions>
        </Composer.Container>
      </Composer.Root>
    </div>
  );
};

// The store holds the items; the parts are structural slots with no opinion
// about how a file should look.
const Strip = () => {
  const attachments = useComposer((composer) => composer.attachments);

  if (attachments.items.length === 0) return null;

  return (
    <Attachments.Root className="flex flex-wrap gap-2 px-3 pt-3">
      {attachments.items.map((item) => (
        <Attachments.Item
          key={item.id}
          className="flex items-center gap-2 rounded-xl border border-[#f0f0f0] bg-[#fafafa] py-1.5 pr-1.5 pl-2.5 text-xs dark:border-[#262626] dark:bg-[#1f1f1f]"
        >
          <span className="max-w-40 truncate">{item.filename ?? "file"}</span>
          <span className="text-[#949494] dark:text-[#6f6f6f]">
            {formatFileSize(item.fileSize)}
          </span>
          <Attachments.Remove
            onRemove={() => attachments.remove(item.id)}
            filename={item.filename}
            className="flex size-5 cursor-pointer items-center justify-center rounded-full text-[#949494] transition-colors hover:bg-[#ececec] hover:text-[#1a1a1a] dark:hover:bg-[#2d2d2d] dark:hover:text-[#fcfcfc]"
          >
            <IconX className="size-3.5" />
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
