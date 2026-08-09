"use client";

import { Chip } from "@intentface/chat/chip";
import type { ComponentProps, ReactElement, ReactNode } from "react";

// Chips flow inline with text. `variant` is an opaque string surfaced as
// data-variant, so the tinting rules are entirely yours.
export const Basic = () => (
  <p className="max-w-md text-sm leading-8 text-[#1a1a1a] dark:text-[#fcfcfc]">
    Pulled results from{" "}
    <Chip.Root variant="accent" className={CHIP_CLASS}>
      <Chip.Icon className="flex items-center">
        <GlobeIcon />
      </Chip.Icon>
      <Chip.Label>web-search</Chip.Label>
    </Chip.Root>{" "}
    and a{" "}
    <Chip.Root className={CHIP_CLASS} renderWithPreview={renderWithPreview}>
      <Chip.Label>document</Chip.Label>
      <Chip.Preview>Hover shows a preview panel for the referenced item.</Chip.Preview>
    </Chip.Root>{" "}
    reference, with one{" "}
    <Chip.Root variant="warning" className={CHIP_CLASS}>
      <Chip.Label>deprecated</Chip.Label>
    </Chip.Root>{" "}
    flag.
  </p>
);

const CHIP_CLASS =
  "mx-0.5 inline-flex items-center gap-1 rounded-md border border-[#f0f0f0] bg-[#f4f4f4] px-1.5 py-0.5 align-baseline text-xs font-medium data-[variant=accent]:border-blue-200 data-[variant=accent]:bg-blue-50 data-[variant=accent]:text-blue-700 data-[variant=warning]:border-amber-200 data-[variant=warning]:bg-amber-50 data-[variant=warning]:text-amber-700 dark:border-[#2d2d2d] dark:bg-[#232323] dark:data-[variant=accent]:border-blue-900 dark:data-[variant=accent]:bg-blue-950 dark:data-[variant=accent]:text-blue-300 dark:data-[variant=warning]:border-amber-900 dark:data-[variant=warning]:bg-amber-950 dark:data-[variant=warning]:text-amber-300";

// Chip.Preview renders nothing on its own — Root hands you the badge and the
// preview content, and you compose whatever popup you want. This one is pure
// CSS so the demo needs no floating library.
const renderWithPreview = (badge: ReactElement, preview: ReactNode) => (
  <span className="group relative inline-block">
    {badge}
    <span className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-1 w-52 -translate-x-1/2 rounded-lg border border-[#f0f0f0] bg-white p-2 text-xs leading-snug text-[#686868] opacity-0 shadow-md transition-opacity group-hover:opacity-100 dark:border-[#2d2d2d] dark:bg-[#181818] dark:text-[#9b9b9b]">
      {preview}
    </span>
  </span>
);

const GlobeIcon = (props: ComponentProps<"svg">) => (
  <svg
    width="12"
    height="12"
    viewBox="0 0 16 16"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.5"
    aria-hidden="true"
    {...props}
  >
    <circle cx="8" cy="8" r="6" />
    <path d="M2 8h12M8 2c1.7 1.8 2.5 3.8 2.5 6S9.7 12.2 8 14C6.3 12.2 5.5 10.2 5.5 8S6.3 3.8 8 2Z" />
  </svg>
);
