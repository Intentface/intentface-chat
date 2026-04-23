"use client";

import Select from "@/components/ui/select";
import {
  ALL_MODELS,
  INCEPTION_MODELS,
  type ModelId,
  OPENAI_MODELS,
} from "@/lib/models";
import { useSettingsStore } from "@/lib/store/settings";

type ModelSelectorProps = {
  value: ModelId;
  onValueChange: (value: ModelId) => void;
};

export const ModelSelector = ({ value, onValueChange }: ModelSelectorProps) => {
  const showBalsam = useSettingsStore((state) => state.showBalsam);
  const models = showBalsam
    ? ALL_MODELS
    : ([...OPENAI_MODELS, ...INCEPTION_MODELS] as const);

  return (
    <Select
      value={value}
      onValueChange={(newValue) => {
        if (newValue) onValueChange(newValue as ModelId);
      }}
    >
      <Select.Trigger variant="ghost" size="sm" className="rounded-full">
        <Select.Value placeholder="Select model">
          {ALL_MODELS.find((model) => model.id === value)?.label}
        </Select.Value>
      </Select.Trigger>
      <Select.Content
        side="top"
        sideOffset={8}
        align="start"
        alignItemWithTrigger={false}
      >
        {models.map((model) => (
          <Select.Item key={model.id} value={model.id}>
            {model.label}
          </Select.Item>
        ))}
      </Select.Content>
    </Select>
  );
};
