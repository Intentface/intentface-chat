"use client";

import Select from "@/components/ui/select";
import type { GeminiModelId } from "@/lib/models";
import { GEMINI_MODELS } from "@/lib/models";

type ModelSelectorProps = {
  value: GeminiModelId;
  onValueChange: (value: GeminiModelId) => void;
};

export const ModelSelector = ({ value, onValueChange }: ModelSelectorProps) => {
  return (
    <Select
      value={value}
      onValueChange={(newValue) => {
        if (newValue) onValueChange(newValue as GeminiModelId);
      }}
    >
      <Select.Trigger variant="ghost" size="sm">
        <Select.Value placeholder="Select model">
          {GEMINI_MODELS.find((model) => model.id === value)?.label}
        </Select.Value>
      </Select.Trigger>
      <Select.Content
        side="top"
        sideOffset={8}
        align="start"
        alignItemWithTrigger={false}
      >
        {GEMINI_MODELS.map((model) => (
          <Select.Item key={model.id} value={model.id}>
            {model.label}
          </Select.Item>
        ))}
      </Select.Content>
    </Select>
  );
};
