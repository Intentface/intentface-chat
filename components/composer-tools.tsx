"use client";

import { PlusIcon, XIcon } from "lucide-react";
import { useComposer } from "@/components/ai/composer";
import { BrainIcon } from "@/components/icons/brain";
import { GlobeIcon } from "@/components/icons/globe";
import { PaperClipIcon } from "@/components/icons/paperclip";
import Button from "@/components/ui/button";
import DropdownMenu from "@/components/ui/dropdown-menu";
import { IconButton } from "@/components/ui/icon-button";

export const ActiveTools = () => {
  const { tools } = useComposer();

  return (
    <div className="flex items-center gap-px">
      {tools.webSearch && (
        <Button
          type="button"
          variant="ghost"
          className="group/pill cursor-pointer rounded-full font-normal"
          onClick={() => tools.setWebSearch(false)}
        >
          <span className="relative size-4">
            <GlobeIcon className="opacity-100 absolute top-0 left-0 group-hover/pill:opacity-0" />
            <XIcon className="opacity-0 absolute top-0 left-0 group-hover/pill:opacity-100" />
          </span>
          Web Search
        </Button>
      )}

      {tools.thinking && (
        <Button
          type="button"
          variant="ghost"
          className="group/pill cursor-pointer rounded-full font-normal"
          onClick={() => tools.setThinking(false)}
        >
          <span className="relative size-4">
            <BrainIcon className="opacity-100 absolute top-0 left-0 group-hover/pill:opacity-0" />
            <XIcon className="opacity-0 absolute top-0 left-0 group-hover/pill:opacity-100" />
          </span>
          Thinking
        </Button>
      )}
    </div>
  );
};

export const ToolsMenu = () => {
  const { attachments, tools } = useComposer();

  return (
    <DropdownMenu>
      <DropdownMenu.Trigger
        render={
          <IconButton variant="ghost" type="button" className="rounded-full">
            <PlusIcon />
          </IconButton>
        }
      />
      <DropdownMenu.Content
        side="top"
        align="start"
        sideOffset={8}
        className="w-auto"
      >
        <DropdownMenu.Item onClick={() => attachments.openFileDialog()}>
          <PaperClipIcon />
          <span className="flex-1">Attach files</span>
        </DropdownMenu.Item>
        <DropdownMenu.Separator />
        <DropdownMenu.SwitchItem
          checked={tools.webSearch}
          onCheckedChange={tools.setWebSearch}
        >
          <GlobeIcon /> <span className="flex-1">Web Search</span>
        </DropdownMenu.SwitchItem>
        <DropdownMenu.SwitchItem
          checked={tools.thinking}
          onCheckedChange={tools.setThinking}
        >
          <BrainIcon /> <span className="flex-1">Thinking</span>
        </DropdownMenu.SwitchItem>
      </DropdownMenu.Content>
    </DropdownMenu>
  );
};
