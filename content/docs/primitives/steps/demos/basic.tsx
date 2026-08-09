"use client";

import { Steps } from "@intentface/chat/steps";
import type { ComponentProps } from "react";

// Steps is recursive: an item's panel can hold rows and further items. A nested
// panel picks up data-nested, which is how the rail indent is drawn.
export const Basic = () => (
  <div className="w-full max-w-xl">
    <Steps.Root className="w-full">
      <Steps.Item defaultOpen>
        <Steps.Trigger className="group/trigger flex w-full cursor-pointer items-center gap-2 py-1 text-sm text-[#686868] transition-colors hover:text-[#1a1a1a] dark:text-[#9b9b9b] dark:hover:text-[#fcfcfc]">
          <span>Worked for 3 seconds</span>
          <ChevronIcon className="size-4 shrink-0 -rotate-90 transition-transform group-data-open/trigger:rotate-0" />
        </Steps.Trigger>
        <Steps.Panel className="mt-2 flex flex-col in-data-nested:ml-2 in-data-nested:border-l in-data-nested:border-[#f0f0f0] in-data-nested:pl-4 dark:in-data-nested:border-[#262626]">
          <div className="flex items-center gap-2 py-0.5">
            <Steps.Icon className={ICON_CLASS}>
              <CheckIcon />
            </Steps.Icon>
            <Steps.Label className={LABEL_CLASS}>Read the request</Steps.Label>
          </div>

          <Steps.Item defaultOpen>
            <Steps.Trigger className="group/trigger flex w-full cursor-pointer items-center gap-2 py-0.5">
              <Steps.Icon className={ICON_CLASS}>
                <CheckIcon />
              </Steps.Icon>
              <Steps.Label className={LABEL_CLASS}>Searched the web</Steps.Label>
            </Steps.Trigger>
            <Steps.Panel className="flex flex-col in-data-nested:ml-2 in-data-nested:border-l in-data-nested:border-[#f0f0f0] in-data-nested:pl-4 dark:in-data-nested:border-[#262626]">
              <span className="py-0.5 text-sm text-[#686868] dark:text-[#9b9b9b]">
                Found three relevant sources and skimmed each.
              </span>
            </Steps.Panel>
          </Steps.Item>

          <div className="flex items-center gap-2 py-0.5">
            <Steps.Icon status="active" className={ICON_CLASS}>
              <CircleIcon className="animate-pulse" />
            </Steps.Icon>
            <Steps.Label status="active" className={LABEL_CLASS}>
              Writing the answer
            </Steps.Label>
          </div>
        </Steps.Panel>
      </Steps.Item>
    </Steps.Root>
  </div>
);

// Status is inherited from the enclosing item and surfaced as data-status, so
// one class string covers every state.
const ICON_CLASS =
  "flex size-4 shrink-0 items-center justify-center data-[status=complete]:text-[#686868] data-[status=active]:text-[#1a1a1a] data-[status=pending]:text-[#949494] dark:data-[status=complete]:text-[#9b9b9b] dark:data-[status=active]:text-[#fcfcfc] dark:data-[status=pending]:text-[#6f6f6f]";

const LABEL_CLASS =
  "text-left text-sm data-[status=complete]:text-[#686868] data-[status=active]:font-medium data-[status=active]:text-[#1a1a1a] data-[status=pending]:text-[#949494] dark:data-[status=complete]:text-[#9b9b9b] dark:data-[status=active]:text-[#fcfcfc] dark:data-[status=pending]:text-[#6f6f6f]";

const ChevronIcon = (props: ComponentProps<"svg">) => (
  <svg
    width="16"
    height="16"
    viewBox="0 0 16 16"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.5"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
    {...props}
  >
    <path d="m4 6 4 4 4-4" />
  </svg>
);

const CheckIcon = (props: ComponentProps<"svg">) => (
  <svg
    width="14"
    height="14"
    viewBox="0 0 16 16"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.75"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
    {...props}
  >
    <path d="m2.5 8.5 4 4 7-9" />
  </svg>
);

const CircleIcon = (props: ComponentProps<"svg">) => (
  <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true" {...props}>
    <circle cx="8" cy="8" r="4" />
  </svg>
);
