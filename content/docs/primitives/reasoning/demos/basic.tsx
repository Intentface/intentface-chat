"use client";

import { Reasoning } from "@intentface/chat/reasoning";
import { Brain, ChevronDown } from "@keyline-icons/react";

// A completed reasoning block. The parts ship no copy and no layout — the
// trigger label and the section structure below are both yours.
const SECTIONS = [
  {
    header: "Planning the approach",
    body: "Check the existing layout, then decide which axis needs centering.",
  },
  {
    header: "Verifying",
    body: "Confirm the element centers both horizontally and vertically.",
  },
];

export const Basic = () => (
  <div className="w-full max-w-xl">
    <Reasoning.Root defaultOpen className="flex flex-col gap-1">
      <Reasoning.Trigger className="group flex w-fit cursor-pointer items-center gap-2 rounded-full font-medium text-[13px] text-zinc-500 transition-colors hover:text-zinc-900 focus-visible:outline-2 focus-visible:outline-[#0169cc]/60 focus-visible:outline-offset-2 dark:text-zinc-400 dark:hover:text-zinc-100">
        <Brain className="size-[15px]" />
        Thought for a few seconds
        <ChevronDown className="size-3 transition-transform group-data-closed:rotate-180" />
      </Reasoning.Trigger>
      <Reasoning.Content className="flex flex-col gap-3 pl-6 text-[13px]">
        {SECTIONS.map((section) => (
          <div key={section.header} className="flex flex-col gap-0.5">
            <span className="font-medium text-zinc-900 dark:text-zinc-100">{section.header}</span>
            <p className="text-zinc-500 leading-5 dark:text-zinc-400">{section.body}</p>
          </div>
        ))}
      </Reasoning.Content>
    </Reasoning.Root>
  </div>
);
