"use client";

import { CheckMarkMediumIcon } from "@/components/icons/check-mark-medium";
import { ChevronGrabberVerticalIcon } from "@/components/icons/chevron-grabber-vertical";
import { ClaudeIcon } from "@/components/icons/claude";
import { GeminiIcon } from "@/components/icons/gemini";
import { GrokIcon } from "@/components/icons/grok";
import { InceptionIcon } from "@/components/icons/inception";
import { OpenAIIcon } from "@/components/icons/openai";
import Button from "@/components/ui/button";
import DropdownMenu from "@/components/ui/dropdown-menu";
import {
  ALL_MODELS,
  INCEPTION_MODELS,
  type ModelId,
  OPENAI_MODELS,
} from "@/lib/models";
import { cn } from "@/lib/utils";

type ModelSelectorProps = {
  value: ModelId;
  onValueChange: (value: ModelId) => void;
};

const PROVIDER_GROUPS = [
  { provider: "openai", label: "OpenAI", models: OPENAI_MODELS },
  { provider: "inception", label: "Inception", models: INCEPTION_MODELS },
] as const;

const DISABLED_PROVIDERS = [
  { provider: "grok", label: "Grok" },
  { provider: "gemini", label: "Gemini" },
  { provider: "claude", label: "Claude" },
] as const;

const getProviderIcon = (
  provider:
    | (typeof PROVIDER_GROUPS)[number]["provider"]
    | (typeof DISABLED_PROVIDERS)[number]["provider"],
) => {
  switch (provider) {
    case "openai":
      return OpenAIIcon;
    case "inception":
      return InceptionIcon;
    case "grok":
      return GrokIcon;
    case "gemini":
      return GeminiIcon;
    case "claude":
      return ClaudeIcon;
    default:
      return null;
  }
};

export const ModelSelector = ({ value, onValueChange }: ModelSelectorProps) => {
  const currentModel = ALL_MODELS.find((model) => model.id === value);
  const currentLabel = currentModel?.label ?? "Select model";
  const CurrentProviderIcon = currentModel
    ? getProviderIcon(currentModel.provider)
    : null;

  return (
    <DropdownMenu>
      <DropdownMenu.Trigger
        render={
          <Button
            variant="ghost"
            size="md"
            type="button"
            className="rounded-full gap-1.5"
          >
            {CurrentProviderIcon ? (
              <CurrentProviderIcon className="text-ink-secondary" />
            ) : null}
            <span>{currentLabel}</span>
            <ChevronGrabberVerticalIcon className="text-ink-tertiary" />
          </Button>
        }
      />
      <DropdownMenu.Content side="top" align="start" sideOffset={8}>
        {PROVIDER_GROUPS.map((group) => {
          const GroupProviderIcon = getProviderIcon(group.provider);

          return (
            <DropdownMenu.Sub key={group.provider}>
              <DropdownMenu.SubTrigger>
                {GroupProviderIcon ? (
                  <GroupProviderIcon className="text-ink-secondary" />
                ) : null}
                <span>{group.label}</span>
              </DropdownMenu.SubTrigger>
              <DropdownMenu.SubContent>
                {group.models.map((model) => {
                  return (
                    <DropdownMenu.Item
                      key={model.id}
                      onClick={() => onValueChange(model.id)}
                    >
                      <CheckMarkMediumIcon
                        className={cn(value !== model.id && "opacity-0")}
                      />
                      <span>{model.label}</span>
                    </DropdownMenu.Item>
                  );
                })}
              </DropdownMenu.SubContent>
            </DropdownMenu.Sub>
          );
        })}
        <DropdownMenu.Separator />
        {DISABLED_PROVIDERS.map((provider) => {
          const ProviderIcon = getProviderIcon(provider.provider);

          return (
            <DropdownMenu.Sub key={provider.provider}>
              <DropdownMenu.SubTrigger disabled>
                {ProviderIcon ? (
                  <ProviderIcon className="text-ink-secondary" />
                ) : null}
                <span>{provider.label}</span>
              </DropdownMenu.SubTrigger>
            </DropdownMenu.Sub>
          );
        })}
      </DropdownMenu.Content>
    </DropdownMenu>
  );
};
