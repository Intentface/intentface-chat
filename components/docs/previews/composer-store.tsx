"use client";

import { Composer, type ComposerSubmitData } from "@/components/ai/composer";

// A store handle created outside the tree. The button drives the composer
// through store.controller — no context, no hook, no ref threading.
const store = Composer.createStore();

export const ComposerStoreDemo = () => {
  const handleSubmit = (_data: ComposerSubmitData) => {};

  return (
    <div className="flex w-full max-w-xl flex-col items-center gap-3">
      <Composer store={store} onSubmit={handleSubmit}>
        <Composer.Container>
          <Composer.Textarea>
            <Composer.Placeholder placeholder="Driven by an external store handle..." />
          </Composer.Textarea>
          <Composer.Actions>
            <Composer.Submit />
          </Composer.Actions>
        </Composer.Container>
      </Composer>
      <button
        type="button"
        onClick={() => store.controller.insertText("@channel ")}
        className="cursor-pointer rounded-full border border-primary-border bg-primary-bg px-4 py-1.5 font-medium text-ink-secondary text-sm transition-colors hover:bg-primary-bg-hover"
      >
        Insert from outside
      </button>
    </div>
  );
};
