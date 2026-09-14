"use client";

import { Message } from "@intentface/chat/message";
import { Thread, useThread, useThreadVisibility } from "@intentface/chat/thread";

const TURNS = Array.from({ length: 14 }, (_, index) => ({
  id: `turn-${index + 1}`,
  role: index % 2 === 0 ? ("user" as const) : ("assistant" as const),
  title: `Turn ${index + 1}`,
  text:
    index % 2 === 0
      ? `Question ${index / 2 + 1}: how does this behave when the transcript is long?`
      : "It resolves the row lazily by its attribute, so nothing is registered up front and a long transcript costs no more than a short one.",
}));

/*
 * Addressing a row without registering it.
 *
 * `scrollToMessage` finds a row by the `data-message-id` attribute you put on
 * it. There is no wrapper part and no registry: rows are resolved lazily at
 * call time, so a transcript of ten thousand turns costs the same as this one.
 *
 * `useThreadVisibility` is the other half. It reads the same attribute to
 * report which rows are on screen, and it creates its observers on the first
 * subscriber — a thread that never calls it pays nothing.
 */
export const Jump = () => (
  <div className="flex w-full max-w-2xl gap-3">
    <div className="h-80 min-w-0 flex-1 overflow-hidden rounded-xl border border-[#f0f0f0] bg-white dark:border-[#262626] dark:bg-[#181818]">
      <Thread.Root autoScroll="off" className="relative flex h-full w-full overflow-hidden">
        <Thread.Viewport className="h-full w-full overflow-y-auto outline-none">
          <Thread.Content className="flex w-full flex-col gap-4 p-4">
            {TURNS.map((turn) => (
              <Message.Root
                key={turn.id}
                role={turn.role}
                data-message-id={turn.id}
                className="group flex w-full flex-col gap-1"
              >
                <span className="font-medium text-[#949494] text-xs dark:text-[#6f6f6f]">
                  {turn.title}
                </span>
                <Message.Text className="text-[#1a1a1a] text-sm leading-[1.7] dark:text-[#fcfcfc]">
                  {turn.text}
                </Message.Text>
              </Message.Root>
            ))}
          </Thread.Content>
        </Thread.Viewport>

        {/* Both panels live inside the Root, which is how they reach the
            scroll context; neither is a part of the package. */}
        <Outline />
      </Thread.Root>
    </div>
  </div>
);

/** An outline that jumps, and highlights whichever row is being read. */
const Outline = () => {
  const { scrollToMessage } = useThread();
  const { currentMessageId } = useThreadVisibility();

  return (
    <nav
      aria-label="Transcript outline"
      className="flex w-36 shrink-0 flex-col gap-0.5 overflow-y-auto border-[#f0f0f0] border-l p-2 dark:border-[#262626]"
    >
      {TURNS.map((turn) => (
        <button
          key={turn.id}
          type="button"
          onClick={() => scrollToMessage(turn.id, { align: "start" })}
          className={[
            "h-7 shrink-0 cursor-pointer rounded-md px-2 text-left text-xs transition-colors",
            turn.id === currentMessageId
              ? "bg-[#ececec] font-medium text-[#1a1a1a] dark:bg-[#2d2d2d] dark:text-[#fcfcfc]"
              : "text-[#686868] hover:bg-[#f4f4f4] dark:text-[#9b9b9b] dark:hover:bg-[#232323]",
          ].join(" ")}
        >
          {turn.title}
        </button>
      ))}
    </nav>
  );
};
