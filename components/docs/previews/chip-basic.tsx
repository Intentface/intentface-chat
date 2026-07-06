"use client";

import { GlobeIcon } from "lucide-react";
import { Chip } from "@/components/ai/chip";

// Chips flow inline with text. Variants tint the surface; Chip.Preview adds a
// hover card.
export const ChipBasic = () => (
  <p className="max-w-md text-ink-primary text-md leading-8">
    Pulled results from{" "}
    <Chip variant="accent">
      <Chip.Icon>
        <GlobeIcon />
      </Chip.Icon>
      <Chip.Label>web-search</Chip.Label>
    </Chip>{" "}
    and a{" "}
    <Chip>
      <Chip.Label>document</Chip.Label>
      <Chip.Preview>Hover shows a preview panel for the referenced item.</Chip.Preview>
    </Chip>{" "}
    reference, with one{" "}
    <Chip variant="warning">
      <Chip.Label>deprecated</Chip.Label>
    </Chip>{" "}
    flag.
  </p>
);
