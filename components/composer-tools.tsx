"use client";
import { Brain, Globe, Paperclip, Plus, X } from "@keyline-icons/react";

import { useComposer } from "@/components/ai/composer";
import Button from "@/components/ui/button";
import DropdownMenu from "@/components/ui/dropdown-menu";
import { IconButton } from "@/components/ui/icon-button";

// Tool toggle state, owned by the consumer (see ChatInput) and passed in as a
// controlled tools/onToolsChange pair.
type ToolToggleProps = {
  tools: Record<string, boolean>;
  onToolsChange: (tools: Record<string, boolean>) => void;
};

export const ActiveTools = ({ tools, onToolsChange }: ToolToggleProps) => {
  return (
    <div className="flex items-center gap-px">
      {tools.webSearch && (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          aria-label={`Turn off Web Search`}
          className="group/pill gap-1.5 px-2 text-ink-primary text-sm"
          onClick={() => onToolsChange({ ...tools, webSearch: false })}
        >
          <span className="relative size-3.5">
            <Globe className="absolute top-0 left-0 size-3.5 opacity-100 group-hover/pill:opacity-0" />
            <X className="absolute top-0 left-0 size-3.5 opacity-0 group-hover/pill:opacity-100" />
          </span>
          Web Search
          {/* The "on" dot, as in the Paper composer. */}
          <span className="size-1.5 rounded-full bg-accent-bg shadow-[0_0_0_2px_color-mix(in_oklab,var(--color-accent-bg)_15%,transparent)]" />
        </Button>
      )}

      {tools.thinking && (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          aria-label={`Turn off Thinking`}
          className="group/pill gap-1.5 px-2 text-ink-primary text-sm"
          onClick={() => onToolsChange({ ...tools, thinking: false })}
        >
          <span className="relative size-3.5">
            <Brain className="absolute top-0 left-0 size-3.5 opacity-100 group-hover/pill:opacity-0" />
            <X className="absolute top-0 left-0 size-3.5 opacity-0 group-hover/pill:opacity-100" />
          </span>
          Thinking
          {/* The "on" dot, as in the Paper composer. */}
          <span className="size-1.5 rounded-full bg-accent-bg shadow-[0_0_0_2px_color-mix(in_oklab,var(--color-accent-bg)_15%,transparent)]" />
        </Button>
      )}
    </div>
  );
};

export const ToolsMenu = ({ tools, onToolsChange }: ToolToggleProps) => {
  const attachments = useComposer((composer) => composer.attachments);

  return (
    <DropdownMenu>
      <DropdownMenu.Trigger
        render={
          <IconButton variant="primary" size="sm" type="button" aria-label="Add">
            <Plus />
          </IconButton>
        }
      />
      <DropdownMenu.Content side="top" align="start" sideOffset={8} className="w-auto">
        <DropdownMenu.Item onClick={() => attachments.openFileDialog()}>
          <Paperclip />
          <span className="flex-1">Attach files</span>
        </DropdownMenu.Item>
        <DropdownMenu.Separator />
        <DropdownMenu.SwitchItem
          checked={tools.webSearch ?? false}
          onCheckedChange={(checked) => onToolsChange({ ...tools, webSearch: checked })}
        >
          <Globe /> <span className="flex-1">Web Search</span>
        </DropdownMenu.SwitchItem>
        <DropdownMenu.SwitchItem
          checked={tools.thinking ?? false}
          onCheckedChange={(checked) => onToolsChange({ ...tools, thinking: checked })}
        >
          <Brain /> <span className="flex-1">Thinking</span>
        </DropdownMenu.SwitchItem>
      </DropdownMenu.Content>
    </DropdownMenu>
  );
};
