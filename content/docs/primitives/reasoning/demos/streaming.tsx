"use client";

import { Reasoning, useReasoning } from "@intentface/chat/reasoning";
import { IconBrain, IconChevronDown } from "@tabler/icons-react";
import { useEffect, useRef, useState } from "react";

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
      <PanelTransition />

      <Reasoning.Root isStreaming={streaming} defaultOpen className="flex flex-col gap-1">
        <TriggerLabel />
        <Reasoning.Content className="flex flex-col gap-2 pl-6 text-[#686868] text-sm dark:text-[#9b9b9b]">
          {shown.length === 0 ? (
            <span className="text-[#949494] dark:text-[#6f6f6f]">Nothing yet.</span>
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
          className="h-8 cursor-pointer rounded-full border border-[#e4e4e4] bg-white px-4 font-medium text-[#1a1a1a] text-sm transition-colors hover:bg-[#f4f4f4] disabled:cursor-default disabled:opacity-40 dark:border-[#2d2d2d] dark:bg-[#181818] dark:text-[#fcfcfc] dark:hover:bg-[#232323]"
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
    <Reasoning.Trigger className="group flex w-fit cursor-pointer items-center gap-2 rounded text-[#686868] text-sm transition-colors hover:text-[#1a1a1a] focus-visible:outline-2 focus-visible:outline-[#1a1a1a] focus-visible:outline-offset-2 dark:text-[#9b9b9b] dark:hover:text-[#fcfcfc] dark:focus-visible:outline-[#fcfcfc]">
      <IconBrain className="size-4" />
      <span className={isStreaming ? "animate-pulse" : undefined}>
        {isStreaming
          ? "Thinking…"
          : duration === undefined
            ? "Reasoning"
            : `Thought for ${duration}s`}
      </span>
      <IconChevronDown className="size-3 transition-transform group-data-closed:rotate-180" />
    </Reasoning.Trigger>
  );
};

/*
 * `--panel-height` is published only while a transition runs, and released once
 * the panel settles open. That release is what lets the open panel keep growing
 * as sections stream in: with the property gone the declaration is invalid at
 * computed-value time and `height` lands back on `auto`.
 */
const PanelTransition = () => (
  <style>{`
.reasoning-demo [data-reasoning-content] {
  height: var(--panel-height);
  overflow: hidden;
  transition: height 200ms cubic-bezier(0.4, 0, 0.2, 1), opacity 200ms ease-out;
}
.reasoning-demo [data-reasoning-content][data-starting-style],
.reasoning-demo [data-reasoning-content][data-ending-style] { height: 0; opacity: 0; }
`}</style>
);
