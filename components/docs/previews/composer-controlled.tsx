"use client";

import { useState } from "react";
import { Composer, type ComposerSubmitData } from "@/components/ai/composer";

// The Textarea's plain-text value is controlled by the parent: the buttons
// drive it, and typing reports back through onValueChange.
const previewButtonClass =
  "cursor-pointer rounded-full border border-primary-border bg-primary px-4 py-1.5 font-medium text-ink-secondary text-sm transition-colors hover:bg-primary-hover";

export const ComposerControlled = () => {
  const [text, setText] = useState("");
  const handleSubmit = (_data: ComposerSubmitData) => {};

  return (
    <div className="flex w-full max-w-xl flex-col items-center gap-3">
      <Composer onSubmit={handleSubmit}>
        <Composer.Container>
          <Composer.Textarea value={text} onValueChange={setText}>
            <Composer.Placeholder placeholder="Controlled by the parent..." />
          </Composer.Textarea>
          <Composer.Actions>
            <Composer.Submit />
          </Composer.Actions>
        </Composer.Container>
      </Composer>
      <div className="flex items-center gap-2">
        <button
          type="button"
          className={previewButtonClass}
          onClick={() => setText("Summarize this thread")}
        >
          Set prompt
        </button>
        <button type="button" className={previewButtonClass} onClick={() => setText("")}>
          Clear
        </button>
      </div>
    </div>
  );
};
