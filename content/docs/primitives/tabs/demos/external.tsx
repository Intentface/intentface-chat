"use client";

import { Tabs, type TabsStore, useTabsStore } from "@intentface/chat/tabs";
import { type ComponentProps, createElement, type ReactElement, useState } from "react";

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
                {createElement(TAB_ICONS[id] ?? InboxIcon)}
              </Tabs.Icon>
              <span className="min-w-0 truncate">{id}</span>
              <Tabs.Action className="absolute inset-y-0 right-1.5 flex items-center opacity-0 transition-opacity group-hover/tab:opacity-100 group-data-[selected]/tab:opacity-100">
                <Tabs.Close
                  aria-label={`Close ${id}`}
                  className="grid size-5 shrink-0 cursor-pointer place-items-center rounded text-[#949494] transition-colors hover:bg-[#dcdcdc] hover:text-[#1a1a1a] dark:text-[#6f6f6f] dark:hover:bg-[#3d3d3d] dark:hover:text-[#fcfcfc]"
                >
                  <CloseIcon />
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
    <div className="flex flex-wrap items-center gap-2">
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

const CloseIcon = (props: ComponentProps<"svg">) => (
  <svg
    viewBox="0 0 16 16"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.5"
    strokeLinecap="round"
    className="size-3"
    aria-hidden="true"
    {...props}
  >
    <path d="m4.5 4.5 7 7m0-7-7 7" />
  </svg>
);

/* Per-tab icons rather than one generic page glyph — a strip of identical
   icons carries no information, and the whole point of a tab icon is telling
   the tabs apart at a glance. */
const TAB_ICONS: Record<string, (props: ComponentProps<"svg">) => ReactElement> = {
  Inbox: InboxIcon,
  Drafts: PencilIcon,
  Sent: SendIcon,
  Archive: ArchiveIcon,
};

function InboxIcon(props: ComponentProps<"svg">) {
  return (
    <svg
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.3"
      aria-hidden="true"
      {...props}
    >
      <path
        d="M2.5 8.5h3l1 2h3l1-2h3v3a1 1 0 0 1-1 1h-9a1 1 0 0 1-1-1v-3Z"
        strokeLinejoin="round"
      />
      <path
        d="M2.5 8.5 4.1 4.3a1 1 0 0 1 .94-.65h5.92a1 1 0 0 1 .94.65l1.6 4.2"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function PencilIcon(props: ComponentProps<"svg">) {
  return (
    <svg
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.3"
      aria-hidden="true"
      {...props}
    >
      <path d="m10.6 3.1 2.3 2.3-7.2 7.2-3 .7.7-3 7.2-7.2Z" strokeLinejoin="round" />
      <path d="m9.4 4.3 2.3 2.3" strokeLinecap="round" />
    </svg>
  );
}

function SendIcon(props: ComponentProps<"svg">) {
  return (
    <svg
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.3"
      aria-hidden="true"
      {...props}
    >
      <path d="M13.4 2.6 2.6 6.4l4.4 2.6 2.6 4.4 3.8-10.8Z" strokeLinejoin="round" />
      <path d="M13.4 2.6 7 9" strokeLinecap="round" />
    </svg>
  );
}

function ArchiveIcon(props: ComponentProps<"svg">) {
  return (
    <svg
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.3"
      aria-hidden="true"
      {...props}
    >
      <rect x="2.5" y="2.6" width="11" height="3" rx="1" strokeLinejoin="round" />
      <path d="M3.6 5.6v6.8a1 1 0 0 0 1 1h6.8a1 1 0 0 0 1-1V5.6" strokeLinejoin="round" />
      <path d="M6.6 8.4h2.8" strokeLinecap="round" />
    </svg>
  );
}
