"use client";

import { Reasoning } from "@/components/ai/reasoning";

// A completed reasoning block. Bold **Headers** in the content split into
// labelled sections. Open by default here so the layout is visible at rest.
export const ReasoningBasic = () => (
  <div className="w-full max-w-xl">
    <Reasoning defaultOpen>
      <Reasoning.Trigger />
      <Reasoning.Content>
        {
          "**Planning the approach**\nCheck the existing layout, then decide which axis needs centering.\n\n**Verifying**\nConfirm the element centers both horizontally and vertically."
        }
      </Reasoning.Content>
    </Reasoning>
  </div>
);
