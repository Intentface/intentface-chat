"use client";

import { Message, useMessageSelection } from "@intentface/chat/message";
import { useState } from "react";

/*
 * Selection is exposed as a hook rather than a part, so the toolbar it drives
 * stays entirely yours — this one is a small bar, but a popover anchored to the
 * range would read the same value.
 *
 * `useMessageSelection` takes the element to scope to and returns the settled
 * selection inside it, or null. Scoping is the whole point: dragging across two
 * messages, or selecting in the page around them, reports nothing here.
 */
export const Selection = () => {
  const [scope, setScope] = useState<HTMLElement | null>(null);
  const selection = useMessageSelection(scope);
  const [quoted, setQuoted] = useState<string | null>(null);

  return (
    <div className="flex w-full max-w-xl flex-col gap-3">
      {/* biome-ignore lint/a11y/useValidAriaRole: `role` is the message's author, not an ARIA role */}
      <Message.Root
        role="assistant"
        ref={setScope}
        className="rounded-xl border border-[#f0f0f0] bg-white p-4 dark:border-[#262626] dark:bg-[#181818]"
      >
        <Message.Text className="text-[#1a1a1a] text-sm leading-[1.7] dark:text-[#fcfcfc]">
          useMemo caches a computed value and useCallback caches a function reference. Reach for
          either only when something downstream is memoised, because the comparison itself is not
          free. Select any of this sentence.
        </Message.Text>
      </Message.Root>

      {/* Rendered outside the message, and still scoped to it. */}
      <div className="flex min-h-8 items-center justify-center gap-2">
        {selection ? (
          <>
            <span className="max-w-64 truncate text-[#949494] text-xs dark:text-[#6f6f6f]">
              “{selection.text}”
            </span>
            <button
              type="button"
              onClick={() => setQuoted(selection.text)}
              className="h-8 shrink-0 cursor-pointer rounded-full border border-[#e4e4e4] bg-white px-4 font-medium text-[#1a1a1a] text-sm transition-colors hover:bg-[#f4f4f4] dark:border-[#2d2d2d] dark:bg-[#181818] dark:text-[#fcfcfc] dark:hover:bg-[#232323]"
            >
              Quote
            </button>
          </>
        ) : (
          <span className="text-[#949494] text-xs dark:text-[#6f6f6f]">
            Nothing selected in this message.
          </span>
        )}
      </div>

      {quoted && (
        <blockquote className="border-[#e4e4e4] border-l-2 pl-3 text-[#686868] text-sm italic dark:border-[#2d2d2d] dark:text-[#9b9b9b]">
          {quoted}
        </blockquote>
      )}
    </div>
  );
};
