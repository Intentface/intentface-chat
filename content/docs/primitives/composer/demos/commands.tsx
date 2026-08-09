"use client";

import { type CommandItemData, Composer, type ComposerSubmitData } from "@intentface/chat/composer";
import type { ComponentProps } from "react";

const MENTIONS: CommandItemData[] = [
  { value: "readme", label: "README.md", description: "Project overview" },
  { value: "package", label: "package.json", description: "Dependencies and scripts" },
  { value: "composer", label: "composer.tsx", description: "The composer primitive" },
];

// Type "@" to open the list. Panel takes a callback receiving composer state,
// so the command list shows only while a prefix is active.
export const Commands = () => {
  const handleSubmit = (data: ComposerSubmitData) => {
    if (data.kind === "message") {
      console.log(data.text);
    }
  };

  return (
    // Reserve height and bottom-anchor so opening the list grows the composer
    // upward instead of shifting the page.
    <div className="flex min-h-[300px] w-full max-w-xl flex-col justify-end">
      <Composer.Root
        onSubmit={handleSubmit}
        commands={{ "@": { kind: "insert", trigger: "word-boundary", items: MENTIONS } }}
        className="flex flex-col"
      >
        {/* anchor={false} makes the panel an in-flow block that grows the
            composer upward; the default is a portaled overlay. */}
        <Composer.Panel
          anchor={false}
          className="mb-2 overflow-hidden rounded-2xl border border-[#f0f0f0] bg-white dark:border-[#262626] dark:bg-[#181818]"
        >
          {(composer) =>
            composer.commands.active ? (
              // data-empty and data-loading land on Command; the group gates
              // which child shows.
              <Composer.Command prefix="@" className="group/list flex flex-col p-1">
                <Composer.CommandEmpty className="hidden h-8 items-center rounded-[10px] px-3 text-sm text-[#949494] group-data-empty/list:flex dark:text-[#6f6f6f]">
                  No files found.
                </Composer.CommandEmpty>
                <Composer.CommandList className="flex max-h-56 flex-col overflow-y-auto group-data-empty/list:hidden">
                  {(item) => (
                    <Composer.CommandItem
                      value={item.value}
                      className="flex h-8 w-full cursor-pointer items-center gap-2.5 rounded-[10px] px-3 text-sm outline-none select-none data-highlighted:bg-[#f4f4f4] dark:data-highlighted:bg-[#232323]"
                    >
                      <Composer.CommandItemLabel className="font-medium">
                        {item.label}
                      </Composer.CommandItemLabel>
                      {item.description && (
                        <Composer.CommandItemDescription className="truncate text-xs text-[#949494] dark:text-[#6f6f6f]">
                          {item.description}
                        </Composer.CommandItemDescription>
                      )}
                    </Composer.CommandItem>
                  )}
                </Composer.CommandList>
              </Composer.Command>
            ) : null
          }
        </Composer.Panel>
        <Composer.Container className="cursor-text rounded-2xl border border-[#f0f0f0] bg-white shadow-xs transition-colors focus-within:border-[#ececec] dark:border-[#262626] dark:bg-[#181818] dark:focus-within:border-[#2d2d2d]">
          <Composer.Textarea className="max-h-32 min-h-8 overflow-y-auto px-4 pt-3 text-sm **:data-composer-editor:w-full **:data-composer-editor:max-w-none **:data-composer-editor:leading-[1.7] [&_[data-composer-editor]:focus]:outline-none **:data-command-badge:rounded-sm **:data-command-badge:bg-[#f4f4f4] **:data-command-badge:px-0.5 **:data-command-badge:dark:bg-[#232323] **:data-command-hint:text-[#949494]">
            <Composer.Placeholder
              placeholder="Type @ to mention a file…"
              className="leading-[1.7] text-[#949494] dark:text-[#6f6f6f]"
            />
          </Composer.Textarea>
          <Composer.Actions className="flex justify-end gap-2 p-2">
            <Composer.Submit className="flex size-8 items-center justify-center rounded-full bg-[#1a1a1a] text-white transition-opacity disabled:opacity-40 dark:bg-[#fcfcfc] dark:text-[#111111]">
              <SendIcon />
            </Composer.Submit>
          </Composer.Actions>
        </Composer.Container>
      </Composer.Root>
    </div>
  );
};

const SendIcon = (props: ComponentProps<"svg">) => (
  <svg
    width="16"
    height="16"
    viewBox="0 0 16 16"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.5"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
    {...props}
  >
    <path d="M8 13V3m0 0L3.5 7.5M8 3l4.5 4.5" />
  </svg>
);
