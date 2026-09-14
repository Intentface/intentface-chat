"use client";

import { Tabs } from "@intentface/chat/tabs";
import { IconArchive, IconInbox, IconPencil, IconSend, IconX } from "@tabler/icons-react";
import { createElement } from "react";

/*
 * The three close policies side by side. Close the open tab in each strip and
 * watch where the selection lands.
 *
 * `selectOnClose` is the whole difference between them — every other prop is
 * identical. Leaving it unset is not an oversight: a dock that shows nothing
 * after you close the last panel is a legitimate resting state, and the
 * primitive will not pick a successor you did not ask for.
 */
export const Closing = () => (
  <div className="flex w-full flex-col gap-5">
    <Strip
      policy="unset"
      caption="Nothing is selected. Closing what was open shows an empty viewport."
    />
    <Strip
      policy="adjacent"
      caption="Whatever slides into the vacated slot, or the last tab if the tail went. An editor's behaviour."
    />
    <Strip
      policy="recent"
      caption="The tab you were in before this one, falling back to adjacent."
    />
  </div>
);

const TABS = ["Inbox", "Drafts", "Sent", "Archive"];

const Strip = ({
  policy,
  caption,
}: {
  policy: "unset" | "adjacent" | "recent";
  caption: string;
}) => (
  <div className="flex flex-col gap-2">
    <code className="font-mono text-[#1a1a1a] text-xs dark:text-[#fcfcfc]">
      {policy === "unset" ? "selectOnClose unset" : `selectOnClose="${policy}"`}
    </code>

    <Tabs.Root
      defaultItems={TABS}
      defaultValue="Drafts"
      selectOnClose={policy === "unset" ? undefined : policy}
      className="flex flex-col gap-1.5"
    >
      <Tabs.List aria-label={`Tabs, ${policy}`} className="flex shrink-0 items-center gap-1">
        {(id) => (
          <Tabs.Trigger value={id} aria-label={id} className={tabClass}>
            <Tabs.Icon className="shrink-0 text-[#949494] dark:text-[#6f6f6f] [&>svg]:size-3.5">
              {createElement(TAB_ICONS[id] ?? IconInbox)}
            </Tabs.Icon>
            <span className="min-w-0 truncate">{id}</span>

            <Tabs.Action className="absolute inset-y-0 right-1.5 flex items-center opacity-0 transition-opacity group-hover/tab:opacity-100 group-data-[selected]/tab:opacity-100">
              <Tabs.Close
                aria-label={`Close ${id}`}
                className="grid size-5 shrink-0 cursor-pointer place-items-center rounded text-[#949494] transition-colors hover:bg-[#dcdcdc] hover:text-[#1a1a1a] dark:text-[#6f6f6f] dark:hover:bg-[#3d3d3d] dark:hover:text-[#fcfcfc]"
              >
                <IconX className="size-3.5" />
              </Tabs.Close>
            </Tabs.Action>
          </Tabs.Trigger>
        )}
      </Tabs.List>

      <Tabs.Viewport className="flex h-20 items-center justify-center rounded-xl border border-[#f0f0f0] bg-white px-4 text-sm dark:border-[#262626] dark:bg-[#111111]">
        {(id) => <span className="text-[#686868] dark:text-[#9b9b9b]">{id}</span>}
      </Tabs.Viewport>
    </Tabs.Root>

    <p className="text-[#686868] text-xs leading-5 dark:text-[#9b9b9b]">{caption}</p>
  </div>
);

const tabClass = [
  // No strip behind the tabs: they sit on the page ground, and the open one is
  // a white card matching the panel below, so the selection reads as continuous
  // with its content rather than as a highlighted button.
  "group/tab relative flex h-8 w-40 shrink-0 cursor-pointer select-none items-center gap-2 overflow-hidden",
  // pr-7 reserves the close button's slot permanently. Overlaying it would
  // cover the label on any short title, and padding it in on hover would make
  // every tab jump the moment you point at one.
  "rounded-lg pr-7 pl-2.5 text-[#686868] text-sm transition-colors dark:text-[#9b9b9b]",
  "hover:bg-[#e7e7e7] dark:hover:bg-[#262626]",
  "focus-visible:-outline-offset-2 focus-visible:outline-2 focus-visible:outline-[#1a1a1a] dark:focus-visible:outline-[#fcfcfc]",
  "data-[selected]:bg-white data-[selected]:text-[#1a1a1a] data-[selected]:shadow-[0_1px_2px_rgba(0,0,0,0.06)]",
  "dark:data-[selected]:bg-[#2d2d2d] dark:data-[selected]:text-[#fcfcfc]",
].join(" ");

/* Per-tab icons rather than one generic page glyph — a strip of identical
   icons carries no information, and the whole point of a tab icon is telling
   the tabs apart at a glance. */
const TAB_ICONS: Record<string, typeof IconInbox> = {
  Inbox: IconInbox,
  Drafts: IconPencil,
  Sent: IconSend,
  Archive: IconArchive,
};
