"use client";
import { IconBrain, IconPaperclip, IconPlus, IconWorld, IconX } from "@tabler/icons-react";

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
          className="group/pill cursor-pointer rounded-full font-normal"
          onClick={() => onToolsChange({ ...tools, webSearch: false })}
        >
          <span className="relative size-4">
            <IconWorld className="opacity-100 absolute top-0 left-0 group-hover/pill:opacity-0" />
            <IconX className="opacity-0 absolute top-0 left-0 group-hover/pill:opacity-100" />
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
            <IconBrain className="opacity-100 absolute top-0 left-0 group-hover/pill:opacity-0" />
            <IconX className="opacity-0 absolute top-0 left-0 group-hover/pill:opacity-100" />
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
            <IconPlus />
          </IconButton>
        }
      />
      <DropdownMenu.Content side="top" align="start" sideOffset={8} className="w-auto">
        <DropdownMenu.Item onClick={() => attachments.openFileDialog()}>
          <IconPaperclip />
          <span className="flex-1">Attach files</span>
        </DropdownMenu.Item>
        <DropdownMenu.Separator />
        <DropdownMenu.SwitchItem
          checked={tools.webSearch ?? false}
          onCheckedChange={(checked) => onToolsChange({ ...tools, webSearch: checked })}
        >
          <IconWorld /> <span className="flex-1">Web Search</span>
        </DropdownMenu.SwitchItem>
        <DropdownMenu.SwitchItem
          checked={tools.thinking ?? false}
          onCheckedChange={(checked) => onToolsChange({ ...tools, thinking: checked })}
        >
          <IconBrain /> <span className="flex-1">Thinking</span>
        </DropdownMenu.SwitchItem>
      </DropdownMenu.Content>
    </DropdownMenu>
  );
};
