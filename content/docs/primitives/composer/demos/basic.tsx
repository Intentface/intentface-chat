"use client";

import { Composer, type ComposerSubmitData } from "@intentface/chat/composer";
import type { ComponentProps } from "react";

// Every <Composer.Root> owns an isolated store, so a bare composer needs no
// setup beyond an onSubmit handler.
export const Basic = () => {
  const handleSubmit = (data: ComposerSubmitData) => {
    if (data.kind === "message") {
      console.log(data.text, data.files);
    }
  };

  return (
    <Composer.Root onSubmit={handleSubmit} className="flex w-full max-w-xl flex-col">
      <Composer.Container className="cursor-text rounded-2xl border border-[#f0f0f0] bg-white shadow-xs transition-colors focus-within:border-[#ececec] dark:border-[#262626] dark:bg-[#181818] dark:focus-within:border-[#2d2d2d]">
        {/* The editable element is engine-owned and out of JSX reach, so it is
            styled through the data-composer-editor variants. */}
        <Composer.Textarea className="max-h-32 min-h-8 overflow-y-auto px-4 pt-3 text-sm **:data-composer-editor:w-full **:data-composer-editor:max-w-none **:data-composer-editor:leading-[1.7] [&_[data-composer-editor]:focus]:outline-none">
          <Composer.Placeholder
            placeholder="Send a message…"
            className="leading-[1.7] text-[#949494] dark:text-[#6f6f6f]"
          />
        </Composer.Textarea>
        <Composer.Actions className="flex justify-end gap-2 p-2">
          <Composer.Submit className="flex size-8 items-center justify-center rounded-full bg-[#1a1a1a] text-white transition-opacity disabled:opacity-40 dark:bg-[#fcfcfc] dark:text-[#111111]">
            <SendIcon />
          </Composer.Submit>
        </Composer.Actions>
      </Composer.Container>
    </Composer.Root>
  );
};

const SendIcon = (props: ComponentProps<"svg">) => (
  <svg
    width="16"
    height="16"
    viewBox="0 0 16 16"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.5"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
    {...props}
  >
    <path d="M8 13V3m0 0L3.5 7.5M8 3l4.5 4.5" />
  </svg>
);
