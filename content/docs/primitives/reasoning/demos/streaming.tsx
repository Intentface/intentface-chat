"use client";

import { Reasoning, useReasoning } from "@intentface/chat/reasoning";
import { Brain, ChevronDown } from "@keyline-icons/react";
import { useEffect, useRef, useState } from "react";
import "./streaming.css";

const SECTIONS = [
  "Check the existing layout, then decide which axis needs centering.",
  "The parent is already a flex row, so only the cross axis is missing.",
  "Confirm the element centers both horizontally and vertically.",
];

/*
 * The part of Reasoning the hero demo cannot show: what happens while the
 * model is still thinking.
 *
 * `isStreaming` is the only input. The root carries `data-streaming` and
 * `aria-busy` while it is true, and the moment it flips false the elapsed time
 * is captured and handed back through `useReasoning().duration` — so the
 * trigger's label changes without the consumer timing anything.
 *
 * The text arrives on a timer here rather than from a model; the primitive
 * neither knows nor cares where it comes from.
 */
export const Streaming = () => {
  const [streaming, setStreaming] = useState(false);
  const [shown, setShown] = useState<string[]>([]);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  const replay = () => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
    setShown([]);
    setStreaming(true);

    SECTIONS.forEach((section, index) => {
      timers.current.push(
        setTimeout(() => setShown((current) => [...current, section]), (index + 1) * 700),
      );
    });
    timers.current.push(setTimeout(() => setStreaming(false), (SECTIONS.length + 1) * 700));
  };

  return (
    <div className="reasoning-demo flex w-full max-w-xl flex-col gap-3">
      <Reasoning.Root isStreaming={streaming} defaultOpen className="flex flex-col gap-1">
        <TriggerLabel />
        <Reasoning.Content className="flex flex-col gap-2 pl-6 text-[13px] text-zinc-500 leading-5 dark:text-zinc-400">
          {shown.length === 0 ? (
            <span className="text-zinc-400 dark:text-zinc-500">Nothing yet.</span>
          ) : (
            shown.map((section) => <p key={section}>{section}</p>)
          )}
        </Reasoning.Content>
      </Reasoning.Root>

      <div className="flex justify-center">
        <button
          type="button"
          onClick={replay}
          disabled={streaming}
          className="h-8 cursor-pointer rounded-full bg-white bg-linear-to-b from-white to-[#fdfdfd] px-3 font-medium text-[13px] text-zinc-900 shadow-[inset_0_1px_0_#fff,0_0_0_1px_rgb(0_0_0/0.075),0_1px_2px_rgb(0_0_0/0.07),0_2px_6px_-2px_rgb(0_0_0/0.05)] transition-colors hover:from-[#fafafa] hover:to-[#f6f6f6] focus-visible:outline-2 focus-visible:outline-[#0169cc]/60 focus-visible:outline-offset-2 disabled:cursor-default disabled:opacity-40 dark:bg-[#2d2d30] dark:from-[#313134] dark:to-[#2a2a2d] dark:text-zinc-100 dark:shadow-[inset_0_1px_0_rgb(255_255_255/0.1),inset_0_0_0_1px_rgb(255_255_255/0.05),0_0_0_1px_rgb(0_0_0/0.16),0_1px_2px_rgb(0_0_0/0.1)] dark:hover:from-[#38383b] dark:hover:to-[#313134]"
        >
          {streaming ? "Thinking…" : "Replay"}
        </button>
      </div>
    </div>
  );
};

/**
 * The trigger ships no copy. `useReasoning` is how the label learns what to
 * say: `isStreaming` while it runs, then `duration` once the package has
 * captured it.
 */
const TriggerLabel = () => {
  const { isStreaming, duration } = useReasoning();

  return (
    <Reasoning.Trigger className="group flex w-fit cursor-pointer items-center gap-2 rounded-full font-medium text-[13px] text-zinc-500 transition-colors hover:text-zinc-900 focus-visible:outline-2 focus-visible:outline-[#0169cc]/60 focus-visible:outline-offset-2 dark:text-zinc-400 dark:hover:text-zinc-100">
      <Brain className="size-[15px]" />
      <span className={isStreaming ? "animate-pulse" : undefined}>
        {isStreaming
          ? "Thinking…"
          : duration === undefined
            ? "Reasoning"
            : `Thought for ${duration}s`}
      </span>
      <ChevronDown className="size-3 transition-transform group-data-closed:rotate-180" />
    </Reasoning.Trigger>
  );
};
