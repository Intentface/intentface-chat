"use client";

import { Reasoning } from "@intentface/chat/reasoning";
import type { ComponentProps } from "react";

// A completed reasoning block. The parts ship no copy of their own — the
// trigger label and the content rendering are both yours.
export const Basic = () => (
  <div className="w-full max-w-xl">
    <Reasoning.Root
      defaultOpen
      className="rounded-xl border border-[#f0f0f0] dark:border-[#262626]"
    >
      <Reasoning.Trigger className="group flex w-full cursor-pointer items-center gap-2 px-3 py-2.5 text-sm text-[#686868] dark:text-[#6f6f6f]">
        <ChevronIcon className="transition-transform group-data-[panel-open]:rotate-90" />
        Thought for 4 seconds
      </Reasoning.Trigger>
      <Reasoning.Content className="border-t border-[#f0f0f0] px-3 py-2.5 text-sm leading-[1.7] whitespace-pre-line text-[#686868] dark:border-[#262626] dark:text-[#6f6f6f]">
        {
          "Check the existing layout, then decide which axis needs centering.\n\nConfirm the element centers both horizontally and vertically."
        }
      </Reasoning.Content>
    </Reasoning.Root>
  </div>
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
    <path d="m6 3.5 5 4.5-5 4.5" />
  </svg>
);
