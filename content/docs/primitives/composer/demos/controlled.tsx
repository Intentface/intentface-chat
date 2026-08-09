"use client";

import { Composer, type ComposerSubmitData } from "@intentface/chat/composer";
import { type ComponentProps, useState } from "react";

// The Textarea's plain-text value is controlled by the parent: the buttons
// drive it, and typing reports back through onValueChange.
export const Controlled = () => {
  const [text, setText] = useState("");

  const handleSubmit = (data: ComposerSubmitData) => {
    if (data.kind === "message") {
      console.log(data.text);
    }
  };

  return (
    <div className="flex w-full max-w-xl flex-col items-center gap-3">
      <Composer.Root onSubmit={handleSubmit} className="flex w-full flex-col">
        <Composer.Container className="cursor-text rounded-2xl border border-[#f0f0f0] bg-white shadow-xs transition-colors focus-within:border-[#ececec] dark:border-[#262626] dark:bg-[#181818] dark:focus-within:border-[#2d2d2d]">
          <Composer.Textarea
            value={text}
            onValueChange={setText}
            className="max-h-32 min-h-8 overflow-y-auto px-4 pt-3 text-sm **:data-composer-editor:w-full **:data-composer-editor:max-w-none **:data-composer-editor:leading-[1.7] [&_[data-composer-editor]:focus]:outline-none"
          >
            <Composer.Placeholder
              placeholder="Controlled by the parent…"
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
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => setText("Summarize this thread")}
          className="cursor-pointer rounded-full border border-[#f0f0f0] bg-white px-4 py-1.5 text-sm font-medium text-[#686868] transition-colors hover:bg-[#fafafa] dark:border-[#262626] dark:bg-[#181818] dark:text-[#9b9b9b] dark:hover:bg-[#232323]"
        >
          Set prompt
        </button>
        <button
          type="button"
          onClick={() => setText("")}
          className="cursor-pointer rounded-full border border-[#f0f0f0] bg-white px-4 py-1.5 text-sm font-medium text-[#686868] transition-colors hover:bg-[#fafafa] dark:border-[#262626] dark:bg-[#181818] dark:text-[#9b9b9b] dark:hover:bg-[#232323]"
        >
          Clear
        </button>
      </div>
    </div>
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
