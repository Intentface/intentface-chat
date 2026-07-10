"use client";

import { useComposer } from "@/components/ai/composer";
import { BrainIcon } from "@/components/icons/brain";
import { CrossMediumIcon } from "@/components/icons/cross-medium";
import { GlobeIcon } from "@/components/icons/globe";
import { PaperClipIcon } from "@/components/icons/paperclip";
import { PlusMediumIcon } from "@/components/icons/plus-medium";
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
          className="group/pill cursor-pointer rounded-full font-normal"
          onClick={() => onToolsChange({ ...tools, webSearch: false })}
        >
          <span className="relative size-4">
            <GlobeIcon className="opacity-100 absolute top-0 left-0 group-hover/pill:opacity-0" />
            <CrossMediumIcon className="opacity-0 absolute top-0 left-0 group-hover/pill:opacity-100" />
          </span>
          Web Search
        </Button>
      )}

      {tools.thinking && (
        <Button
          type="button"
          variant="ghost"
          className="group/pill cursor-pointer rounded-full font-normal"
          onClick={() => onToolsChange({ ...tools, thinking: false })}
        >
          <span className="relative size-4">
            <BrainIcon className="opacity-100 absolute top-0 left-0 group-hover/pill:opacity-0" />
            <CrossMediumIcon className="opacity-0 absolute top-0 left-0 group-hover/pill:opacity-100" />
          </span>
          Thinking
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
          <IconButton variant="ghost" type="button" className="rounded-full">
            <PlusMediumIcon />
          </IconButton>
        }
      />
      <DropdownMenu.Content side="top" align="start" sideOffset={8} className="w-auto">
        <DropdownMenu.Item onClick={() => attachments.openFileDialog()}>
          <PaperClipIcon />
          <span className="flex-1">Attach files</span>
        </DropdownMenu.Item>
        <DropdownMenu.Separator />
        <DropdownMenu.SwitchItem
          checked={tools.webSearch ?? false}
          onCheckedChange={(checked) => onToolsChange({ ...tools, webSearch: checked })}
        >
          <GlobeIcon /> <span className="flex-1">Web Search</span>
        </DropdownMenu.SwitchItem>
        <DropdownMenu.SwitchItem
          checked={tools.thinking ?? false}
          onCheckedChange={(checked) => onToolsChange({ ...tools, thinking: checked })}
        >
          <BrainIcon /> <span className="flex-1">Thinking</span>
        </DropdownMenu.SwitchItem>
      </DropdownMenu.Content>
    </DropdownMenu>
  );
};
