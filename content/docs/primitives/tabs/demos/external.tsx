"use client";

import { Tabs, type TabsStore, useTabsStore } from "@intentface/chat/tabs";
import { Archive, Inbox, Pen, Send, X } from "@keyline-icons/react";
import { createElement, useState } from "react";

/*
 * Opening a tab from somewhere else in the app.
 *
 * `Tabs.createStore()` is the handle. Pass it to the Root and the buttons
 * below — siblings of the Root, not descendants — can call the same actions
 * the strip calls. This is how a "new chat" button in the window chrome opens
 * a tab in a dock it has no path to through context.
 *
 * `open` adds a tab and selects it, or moves and selects one already present,
 * so the button is idempotent without the caller checking first.
 */
export const ExternalTabs = () => {
  const [store] = useState(() => Tabs.createStore());

  return (
    <div className="flex w-full flex-col gap-3">
      <Tabs.Root
        store={store}
        defaultItems={["Inbox"]}
        defaultValue="Inbox"
        selectOnClose="adjacent"
        className="relative flex flex-col gap-2 rounded-xl bg-[#f5f5f6] p-2 shadow-[0_0_0_1px_rgb(0_0_0/0.075),0_1px_2px_rgb(0_0_0/0.06),0_4px_8px_-2px_rgb(0_0_0/0.05)] dark:bg-[#131315] dark:shadow-[0_0_0_1px_rgb(0_0_0/0.16),0_1px_2px_rgb(0_0_0/0.1)] dark:after:pointer-events-none dark:after:absolute dark:after:inset-0 dark:after:z-50 dark:after:rounded-[inherit] dark:after:shadow-[inset_0_1px_0_rgb(255_255_255/0.05),inset_0_0_0_1px_rgb(255_255_255/0.06)]"
      >
        <Tabs.List aria-label="Documents" className="flex shrink-0 flex-wrap items-center gap-1">
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

        <Tabs.Viewport className="flex h-24 items-center justify-center rounded-lg bg-white px-4 text-[13px] text-zinc-500 shadow-[0_0_0_1px_rgb(0_0_0/0.075),0_1px_2px_rgb(0_0_0/0.06),0_4px_8px_-2px_rgb(0_0_0/0.05)] dark:bg-zinc-900 dark:text-zinc-400 dark:shadow-[inset_0_1px_0_rgb(255_255_255/0.05),inset_0_0_0_1px_rgb(255_255_255/0.06),0_0_0_1px_rgb(0_0_0/0.16),0_1px_2px_rgb(0_0_0/0.1)]">
          {(id) => <span>{id}</span>}
        </Tabs.Viewport>
      </Tabs.Root>

      {/* Outside Tabs.Root entirely. */}
      <Launcher store={store} />
    </div>
  );
};

const DOCUMENTS = ["Drafts", "Sent", "Archive"];

const Launcher = ({ store }: { store: TabsStore }) => {
  const items = useTabsStore(store, (tabs) => tabs.items);

  return (
    <div className="flex flex-wrap items-center justify-center gap-2">
      {DOCUMENTS.map((id) => (
        <button
          key={id}
          type="button"
          onClick={() => store.getSnapshot().open(id)}
          className="h-8 cursor-pointer rounded-full bg-white bg-linear-to-b from-white to-[#fdfdfd] px-4 font-medium text-[13px] text-zinc-900 shadow-[inset_0_1px_0_#fff,0_0_0_1px_rgb(0_0_0/0.075),0_1px_2px_rgb(0_0_0/0.07),0_2px_6px_-2px_rgb(0_0_0/0.05)] transition-colors hover:from-[#fafafa] hover:to-[#f6f6f6] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0169cc]/60 dark:bg-[#2d2d30] dark:from-[#313134] dark:to-[#2a2a2d] dark:text-zinc-100 dark:shadow-[inset_0_1px_0_rgb(255_255_255/0.1),inset_0_0_0_1px_rgb(255_255_255/0.05),0_0_0_1px_rgb(0_0_0/0.16),0_1px_2px_rgb(0_0_0/0.1)] dark:hover:from-[#38383b] dark:hover:to-[#313134]"
        >
          {items.includes(id) ? `Go to ${id}` : `Open ${id}`}
        </button>
      ))}
    </div>
  );
};

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
