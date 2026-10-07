"use client";

import { Tabs } from "@intentface/chat/tabs";
import { Archive, Inbox, Pen, Send, X } from "@keyline-icons/react";
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
    <code className="font-mono text-xs text-zinc-900 dark:text-zinc-100">
      {policy === "unset" ? "selectOnClose unset" : `selectOnClose="${policy}"`}
    </code>

    <Tabs.Root
      defaultItems={TABS}
      defaultValue="Drafts"
      selectOnClose={policy === "unset" ? undefined : policy}
      className="relative flex flex-col gap-2 rounded-xl bg-[#f5f5f6] p-2 shadow-[0_0_0_1px_rgb(0_0_0/0.075),0_1px_2px_rgb(0_0_0/0.06),0_4px_8px_-2px_rgb(0_0_0/0.05)] dark:bg-[#131315] dark:shadow-[0_0_0_1px_rgb(0_0_0/0.16),0_1px_2px_rgb(0_0_0/0.1)] dark:after:pointer-events-none dark:after:absolute dark:after:inset-0 dark:after:z-50 dark:after:rounded-[inherit] dark:after:shadow-[inset_0_1px_0_rgb(255_255_255/0.05),inset_0_0_0_1px_rgb(255_255_255/0.06)]"
    >
      <Tabs.List aria-label={`Tabs, ${policy}`} className="flex shrink-0 items-center gap-1">
        {(id) => (
          <Tabs.Trigger value={id} aria-label={id} className={tabClass}>
            <Tabs.Icon className="shrink-0 text-zinc-500 dark:text-zinc-400 [&>svg]:size-[15px]">
              {createElement(TAB_ICONS[id] ?? Inbox)}
            </Tabs.Icon>
            <span className="min-w-0 truncate">{id}</span>

            <Tabs.Action className="absolute inset-y-0 right-1.5 flex items-center opacity-0 transition-opacity group-hover/tab:opacity-100 group-data-[selected]/tab:opacity-100">
              <Tabs.Close
                aria-label={`Close ${id}`}
                className="grid size-5 shrink-0 cursor-pointer place-items-center rounded-full text-zinc-400 transition-colors hover:bg-zinc-950/5 hover:text-zinc-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0169cc]/60 dark:text-zinc-500 dark:hover:bg-white/8 dark:hover:text-zinc-100"
              >
                <X className="size-3.5" />
              </Tabs.Close>
            </Tabs.Action>
          </Tabs.Trigger>
        )}
      </Tabs.List>

      <Tabs.Viewport className="flex h-20 items-center justify-center rounded-lg bg-white px-4 text-[13px] shadow-[0_0_0_1px_rgb(0_0_0/0.075),0_1px_2px_rgb(0_0_0/0.06),0_4px_8px_-2px_rgb(0_0_0/0.05)] dark:bg-zinc-900 dark:shadow-[inset_0_1px_0_rgb(255_255_255/0.05),inset_0_0_0_1px_rgb(255_255_255/0.06),0_0_0_1px_rgb(0_0_0/0.16),0_1px_2px_rgb(0_0_0/0.1)]">
        {(id) => <span className="text-zinc-500 dark:text-zinc-400">{id}</span>}
      </Tabs.Viewport>
    </Tabs.Root>

    <p className="text-xs text-zinc-500 leading-5 dark:text-zinc-400">{caption}</p>
  </div>
);

const tabClass = [
  // No strip behind the tabs: they sit on the frame's ground, and the open one
  // is raised to match the panel below, so the selection reads as continuous
  // with its content rather than as a highlighted button.
  "group/tab relative flex h-[30px] w-40 min-w-0 shrink cursor-pointer select-none items-center gap-2 overflow-hidden",
  // pr-7 reserves the close button's slot permanently. Overlaying it would
  // cover the label on any short title, and padding it in on hover would make
  // every tab jump the moment you point at one.
  "rounded-md pr-7 pl-2.5 font-medium text-[13px] text-zinc-700 transition-colors dark:text-zinc-300",
  "hover:bg-zinc-950/5 dark:hover:bg-white/8",
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0169cc]/60",
  "data-[selected]:bg-white data-[selected]:bg-linear-to-b data-[selected]:from-white data-[selected]:to-[#fdfdfd] data-[selected]:text-zinc-900",
  "data-[selected]:shadow-[inset_0_1px_0_#fff,0_0_0_1px_rgb(0_0_0/0.075),0_1px_2px_rgb(0_0_0/0.07),0_2px_6px_-2px_rgb(0_0_0/0.05)]",
  "dark:data-[selected]:bg-[#2d2d30] dark:data-[selected]:from-[#313134] dark:data-[selected]:to-[#2a2a2d] dark:data-[selected]:text-zinc-100",
  "dark:data-[selected]:shadow-[inset_0_1px_0_rgb(255_255_255/0.1),inset_0_0_0_1px_rgb(255_255_255/0.05),0_0_0_1px_rgb(0_0_0/0.16),0_1px_2px_rgb(0_0_0/0.1)]",
].join(" ");

/* Per-tab icons rather than one generic page glyph — a strip of identical
   icons carries no information, and the whole point of a tab icon is telling
   the tabs apart at a glance. */
const TAB_ICONS: Record<string, typeof Inbox> = {
  Inbox: Inbox,
  Drafts: Pen,
  Sent: Send,
  Archive: Archive,
};
