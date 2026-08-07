"use client";

import { Reasoning } from "@intentface/chat/reasoning";
import type { ComponentProps } from "react";

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
        <BrainIcon />
        Thought for a few seconds
        <ChevronIcon className="transition-transform group-data-closed:rotate-180" />
      </Reasoning.Trigger>
      <Reasoning.Content className="flex flex-col gap-3 pl-6 text-sm">
        {SECTIONS.map((section) => (
          <div key={section.header} className="flex flex-col gap-0.5">
            <span className="font-medium text-[#1a1a1a] dark:text-[#fcfcfc]">
              {section.header}
            </span>
            <p className="leading-[1.7] text-[#686868] dark:text-[#9b9b9b]">{section.body}</p>
          </div>
        ))}
      </Reasoning.Content>
    </Reasoning.Root>
  </div>
);

const BrainIcon = (props: ComponentProps<"svg">) => (
  <svg
    width="16"
    height="16"
    viewBox="0 0 16 16"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.3"
    strokeLinejoin="round"
    aria-hidden="true"
    {...props}
  >
    <path d="M8 2.5a2 2 0 0 0-2 2 2 2 0 0 0-1.5 3.3A2 2 0 0 0 6 11.5a2 2 0 0 0 4 0 2 2 0 0 0 1.5-3.7A2 2 0 0 0 10 4.5a2 2 0 0 0-2-2Z" />
    <path d="M8 2.5v11" />
  </svg>
);

const ChevronIcon = (props: ComponentProps<"svg">) => (
  <svg
    width="14"
    height="14"
    viewBox="0 0 16 16"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.5"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
    {...props}
  >
    <path d="m4 10 4-4 4 4" />
  </svg>
);
