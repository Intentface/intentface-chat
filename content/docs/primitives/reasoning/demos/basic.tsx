"use client";

import { Reasoning } from "@intentface/chat/reasoning";
import { IconBrain, IconChevronDown } from "@tabler/icons-react";

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
      <Reasoning.Trigger className="group flex w-fit cursor-pointer items-center gap-2 text-sm text-[#686868] transition-colors hover:text-[#1a1a1a] dark:text-[#9b9b9b] dark:hover:text-[#fcfcfc]">
        <IconBrain className="size-4" />
        Thought for a few seconds
        <IconChevronDown className="size-3 transition-transform group-data-closed:rotate-180" />
      </Reasoning.Trigger>
      <Reasoning.Content className="flex flex-col gap-3 pl-6 text-sm">
        {SECTIONS.map((section) => (
          <div key={section.header} className="flex flex-col gap-0.5">
            <span className="font-medium text-[#1a1a1a] dark:text-[#fcfcfc]">{section.header}</span>
            <p className="leading-[1.7] text-[#686868] dark:text-[#9b9b9b]">{section.body}</p>
          </div>
        ))}
      </Reasoning.Content>
    </Reasoning.Root>
  </div>
);
