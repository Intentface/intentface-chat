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
        className="rounded-xl bg-white px-4 py-3.5 shadow-[0_0_0_1px_rgb(0_0_0/0.075),0_1px_2px_rgb(0_0_0/0.06),0_4px_8px_-2px_rgb(0_0_0/0.05)] dark:bg-zinc-800 dark:shadow-[inset_0_1px_0_rgb(255_255_255/0.05),inset_0_0_0_1px_rgb(255_255_255/0.06),0_0_0_1px_rgb(0_0_0/0.16),0_1px_2px_rgb(0_0_0/0.1)]"
      >
        <Message.Text className="text-sm text-zinc-700 leading-6 dark:text-zinc-300">
          useMemo caches a computed value and useCallback caches a function reference. Reach for
          either only when something downstream is memoised, because the comparison itself is not
          free. Select any of this sentence.
        </Message.Text>
      </Message.Root>

      {/* Rendered outside the message, and still scoped to it. */}
      <div className="flex min-h-8 items-center justify-center gap-2">
        {selection ? (
          <>
            <span className="max-w-64 truncate text-xs text-zinc-400 dark:text-zinc-500">
              “{selection.text}”
            </span>
            <button
              type="button"
              onClick={() => setQuoted(selection.text)}
              className="h-8 shrink-0 cursor-pointer rounded-full bg-white bg-linear-to-b from-white to-[#fdfdfd] px-3.5 font-medium text-[13px] text-zinc-900 shadow-[inset_0_1px_0_#fff,0_0_0_1px_rgb(0_0_0/0.075),0_1px_2px_rgb(0_0_0/0.07),0_2px_6px_-2px_rgb(0_0_0/0.05)] hover:from-[#fafafa] hover:to-[#f6f6f6] focus-visible:outline-2 focus-visible:outline-[#0169cc]/60 focus-visible:outline-offset-2 dark:bg-[#2d2d30] dark:from-[#313134] dark:to-[#2a2a2d] dark:text-zinc-100 dark:shadow-[inset_0_1px_0_rgb(255_255_255/0.1),inset_0_0_0_1px_rgb(255_255_255/0.05),0_0_0_1px_rgb(0_0_0/0.16),0_1px_2px_rgb(0_0_0/0.1)] dark:hover:from-[#38383b] dark:hover:to-[#313134]"
            >
              Quote
            </button>
          </>
        ) : (
          <span className="text-xs text-zinc-400 dark:text-zinc-500">
            Nothing selected in this message.
          </span>
        )}
      </div>

      {quoted && (
        <blockquote className="border-zinc-950/10 border-l-2 pl-3 text-sm text-zinc-500 italic leading-6 dark:border-white/10 dark:text-zinc-400">
          {quoted}
        </blockquote>
      )}
    </div>
  );
};
