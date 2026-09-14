"use client";

import { Tabs, type TabsStore, useTabsStore } from "@intentface/chat/tabs";
import { IconArchive, IconInbox, IconPencil, IconSend, IconX } from "@tabler/icons-react";
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
        className="flex flex-col gap-1.5"
      >
        <Tabs.List aria-label="Documents" className="flex shrink-0 flex-wrap items-center gap-1">
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

        <Tabs.Viewport className="flex h-24 items-center justify-center rounded-xl border border-[#f0f0f0] bg-white px-4 text-sm text-[#686868] dark:border-[#262626] dark:bg-[#111111] dark:text-[#9b9b9b]">
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
          className="h-8 cursor-pointer rounded-full border border-[#e4e4e4] bg-white px-4 font-medium text-[#1a1a1a] text-sm transition-colors hover:bg-[#f4f4f4] focus-visible:-outline-offset-2 focus-visible:outline-2 focus-visible:outline-[#1a1a1a] dark:border-[#2d2d2d] dark:bg-[#181818] dark:text-[#fcfcfc] dark:hover:bg-[#232323] dark:focus-visible:outline-[#fcfcfc]"
        >
          {items.includes(id) ? `Go to ${id}` : `Open ${id}`}
        </button>
      ))}
    </div>
  );
};

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
