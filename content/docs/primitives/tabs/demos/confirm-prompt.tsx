"use client";

import { useTabs } from "@intentface/chat/tabs";

export type Asking = { value: string; left: number; top: number };

/** Inside the Root, so Discard can close the tab the same way any code would. */
export const Prompt = ({ asking, onAnswer }: { asking: Asking; onAnswer: () => void }) => {
  const close = useTabs((tabs) => tabs.close);

  return (
    <div
      role="alertdialog"
      aria-labelledby="confirm-close-title"
      aria-describedby="confirm-close-description"
      style={{ left: asking.left, top: asking.top }}
      // Escape answers "keep"; preventDefault so the tabs don't also act on it.
      onKeyDown={(event) => {
        if (event.key !== "Escape") return;
        event.preventDefault();
        onAnswer();
      }}
      className="absolute z-60 flex w-64 flex-col gap-3 rounded-xl bg-white p-3 shadow-[0_0_0_1px_rgb(0_0_0/0.075),0_1px_2px_rgb(0_0_0/0.06),0_12px_32px_-8px_rgb(0_0_0/0.16)] transition-[opacity,translate] duration-150 ease-out starting:-translate-y-1 starting:opacity-0 dark:bg-zinc-800 dark:shadow-[inset_0_1px_0_rgb(255_255_255/0.06),inset_0_0_0_1px_rgb(255_255_255/0.07),0_0_0_1px_rgb(0_0_0/0.16),0_12px_32px_-8px_rgb(0_0_0/0.4)]"
    >
      <div className="flex flex-col gap-1">
        <p
          id="confirm-close-title"
          className="font-medium text-[13px] text-zinc-900 dark:text-zinc-100"
        >
          Discard changes?
        </p>
        <p
          id="confirm-close-description"
          className="text-xs text-zinc-500 leading-[18px] dark:text-zinc-400"
        >
          {`${asking.value} has unsaved changes. Closing it throws them away.`}
        </p>
      </div>
      <div className="flex justify-end gap-1.5">
        {/* The safe answer takes focus, so a stray Enter keeps the work. */}
        <button type="button" ref={focusOnMount} onClick={onAnswer} className={buttonClass}>
          Keep
        </button>
        <button
          type="button"
          onClick={() => {
            onAnswer();
            close(asking.value);
          }}
          className="h-7 cursor-pointer rounded-full bg-[#0169cc] bg-linear-to-b from-[oklch(57.2%_0.166_253.2)] to-[oklch(52.9%_0.173_255)] px-3 font-medium text-[13px] text-white shadow-[inset_0_1px_0_rgb(255_255_255/0.28),0_0_0_1px_oklch(46.5%_0.146_254.8),0_1px_2px_rgb(1_105_204/0.35)] focus-visible:outline-2 focus-visible:outline-[#0169cc]/60 focus-visible:outline-offset-2"
        >
          Discard
        </button>
      </div>
    </div>
  );
};

// A stable ref callback, so focus moves once when the prompt mounts.
const focusOnMount = (element: HTMLButtonElement | null) => element?.focus();

const buttonClass = [
  "h-7 cursor-pointer rounded-full px-3 font-medium text-[13px] text-zinc-900 transition-colors dark:text-zinc-100",
  "bg-white bg-linear-to-b from-white to-[#fdfdfd] hover:from-[#fafafa] hover:to-[#f6f6f6]",
  "shadow-[inset_0_1px_0_#fff,0_0_0_1px_rgb(0_0_0/0.075),0_1px_2px_rgb(0_0_0/0.07),0_2px_6px_-2px_rgb(0_0_0/0.05)]",
  "dark:bg-[#2d2d30] dark:from-[#313134] dark:to-[#2a2a2d] dark:hover:from-[#38383b] dark:hover:to-[#313134]",
  "dark:shadow-[inset_0_1px_0_rgb(255_255_255/0.1),inset_0_0_0_1px_rgb(255_255_255/0.05),0_0_0_1px_rgb(0_0_0/0.16),0_1px_2px_rgb(0_0_0/0.1)]",
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0169cc]/60",
].join(" ");
