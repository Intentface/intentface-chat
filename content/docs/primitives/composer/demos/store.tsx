"use client";

import { Composer, type ComposerSubmitData } from "@intentface/chat/composer";
import { IconArrowUp } from "@tabler/icons-react";

// A store handle created outside the tree. The button drives the composer
// through store.controller — no context, no hook, no ref threading.
const store = Composer.createStore();

export const Store = () => {
  const handleSubmit = (data: ComposerSubmitData) => {
    if (data.kind === "message") {
      console.log(data.text);
    }
  };

  return (
    <div className="flex w-full max-w-xl flex-col items-center gap-3">
      <Composer.Root store={store} onSubmit={handleSubmit} className="flex w-full flex-col">
        <Composer.Container className="cursor-text rounded-2xl border border-[#f0f0f0] bg-white shadow-xs transition-colors focus-within:border-[#ececec] dark:border-[#262626] dark:bg-[#181818] dark:focus-within:border-[#2d2d2d]">
          <Composer.Textarea className="max-h-32 min-h-8 overflow-y-auto px-4 pt-3 text-sm **:data-composer-editor:w-full **:data-composer-editor:max-w-none **:data-composer-editor:leading-[1.7] [&_[data-composer-editor]:focus]:outline-none">
            <Composer.Placeholder
              placeholder="Driven by an external store handle…"
              className="leading-[1.7] text-[#949494] dark:text-[#6f6f6f]"
            />
          </Composer.Textarea>
          <Composer.Actions className="flex justify-end gap-2 p-2">
            <Composer.Submit className="flex size-8 items-center justify-center rounded-full bg-[#1a1a1a] text-white transition-opacity disabled:opacity-40 dark:bg-[#fcfcfc] dark:text-[#111111]">
              <IconArrowUp className="size-4" />
            </Composer.Submit>
          </Composer.Actions>
        </Composer.Container>
      </Composer.Root>
      <button
        type="button"
        onClick={() => store.controller.insertText("@channel ")}
        className="cursor-pointer rounded-full border border-[#f0f0f0] bg-white px-4 py-1.5 text-sm font-medium text-[#686868] transition-colors hover:bg-[#fafafa] dark:border-[#262626] dark:bg-[#181818] dark:text-[#9b9b9b] dark:hover:bg-[#232323]"
      >
        Insert from outside
      </button>
    </div>
  );
};
