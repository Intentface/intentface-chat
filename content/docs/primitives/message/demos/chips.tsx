"use client";

import { Chip } from "@intentface/chat/chip";
import { Message, type MessageChipSegment } from "@intentface/chat/message";
import { IconFile, IconFileText, IconTool } from "@tabler/icons-react";
import type { ComponentProps } from "react";

/*
 * A message whose text carries inline chip references, and the renderers that
 * turn them back into chips.
 *
 * The wire format is a markdown-shaped link: `[Label](chip:prefix:value)`, with
 * everything the chip needs riding along inside the token. That is the point —
 * a stored message reconstructs its own chips from its text alone, with no
 * sidecar array of metadata to keep in sync or migrate.
 *
 * `Message.Text` parses the tokens and calls `renderChip` for each one. What a
 * chip looks like, and whether a prefix earns a different variant, is decided
 * here at render time rather than baked into the stored text.
 */
const TEXT =
  "I compared [pricing.tsx](chip:file:src/app/pricing.tsx) against " +
  "[the Q3 brief](chip:doc:q3-brief) and pulled figures from " +
  "[web-search](chip:tool:web-search). The deprecated rate in " +
  "[legacy.ts](chip:file:src/legacy.ts) is the only mismatch.";

export const Chips = () => (
  <div className="w-full max-w-xl">
    {/* biome-ignore lint/a11y/useValidAriaRole: `role` is the message's author, not an ARIA role */}
    <Message.Root role="assistant">
      <Message.Text
        renderChip={renderChip}
        className="text-[#1a1a1a] text-sm leading-8 dark:text-[#fcfcfc]"
      >
        {TEXT}
      </Message.Text>
    </Message.Root>
  </div>
);

/** The prefix decides the variant and the icon; neither is stored in the text. */
const renderChip = (chip: MessageChipSegment, index: number) => (
  <Chip.Root
    key={`${chip.prefix}-${chip.value}-${index}`}
    variant={chip.prefix === "tool" ? "accent" : "primary"}
    className={chipClass}
  >
    <Chip.Icon className="flex items-center">
      {chip.prefix === "file" ? (
        <IconFile className="size-4" />
      ) : chip.prefix === "doc" ? (
        <IconFileText className="size-4" />
      ) : (
        <IconTool className="size-4" />
      )}
    </Chip.Icon>
    <Chip.Label>{chip.label}</Chip.Label>
  </Chip.Root>
);

const chipClass =
  "mx-0.5 inline-flex items-center gap-1 rounded-md border border-[#f0f0f0] bg-[#f4f4f4] px-1.5 py-0.5 align-baseline font-medium text-xs data-[variant=accent]:border-blue-200 data-[variant=accent]:bg-blue-50 data-[variant=accent]:text-blue-700 dark:border-[#2d2d2d] dark:bg-[#232323] dark:data-[variant=accent]:border-blue-900 dark:data-[variant=accent]:bg-blue-950 dark:data-[variant=accent]:text-blue-300";

const _icon = (props: ComponentProps<"svg">) => ({
  viewBox: "0 0 16 16",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.3,
  className: "size-3",
  "aria-hidden": true,
  ...props,
});
