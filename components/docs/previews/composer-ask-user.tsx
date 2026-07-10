"use client";

import { useState } from "react";
import { AskUser } from "@/components/ai/ask-user";

const OPTIONS = [
  { value: "bun", label: "Bun", description: "Fastest installs; the repo default." },
  { value: "pnpm", label: "pnpm", description: "Strict, content-addressed store." },
  { value: "npm", label: "npm", description: "Ships with Node, zero setup." },
];

// A single-select ask-user prompt. Options wraps its children in a RadioGroup
// when multiSelect is false; clicking a card selects it.
export const ComposerAskUser = () => {
  const [value, setValue] = useState("bun");

  return (
    <div className="w-full max-w-md rounded-xl border border-primary-border bg-secondary p-2">
      <AskUser>
        <AskUser.Header>
          <AskUser.Label>Which package manager should the setup use?</AskUser.Label>
        </AskUser.Header>
        <AskUser.Options>
          {OPTIONS.map((option) => (
            <AskUser.Option
              key={option.value}
              value={option.value}
              selected={value === option.value}
              onSelect={() => setValue(option.value)}
            >
              <AskUser.OptionInput />
              <AskUser.OptionContent>
                <AskUser.OptionLabel>{option.label}</AskUser.OptionLabel>
                <AskUser.OptionDescription>{option.description}</AskUser.OptionDescription>
              </AskUser.OptionContent>
            </AskUser.Option>
          ))}
        </AskUser.Options>
      </AskUser>
    </div>
  );
};
