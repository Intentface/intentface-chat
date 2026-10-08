"use client";

import { Tabs } from "@intentface/chat/tabs";
import { type ComponentProps, useRef, useState } from "react";
import { type Asking, Prompt } from "./confirm-prompt";

/*
 * Closing a tab with unsaved changes asks first.
 *
 * Every change arrives with `eventDetails`, and `eventDetails.cancel()` stops it
 * landing. The × and Delete report "close-press" and "keyboard", so cancelling
 * those keeps the tab while the prompt waits. Discard then calls `close()` from
 * code, which reports "imperative-action" and goes through.
 *
 * The prompt is a small popover under the tab being closed, placed from that
 * tab's own offset — no floating library needed for a demo this size.
 */

const DOCUMENTS = ["Brief", "Roadmap", "Notes"];
const UNSAVED = new Set(["Roadmap"]);

export const ConfirmClose = () => {
  const [items, setItems] = useState(DOCUMENTS);
  const [asking, setAsking] = useState<Asking | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);

  return (
    <Tabs.Root
      ref={rootRef}
      items={items}
      defaultValue="Roadmap"
      selectOnClose="adjacent"
      onItemsChange={(next, eventDetails) => {
        const closing = items.find((id) => !next.includes(id));
        const byUser = eventDetails.reason === "close-press" || eventDetails.reason === "keyboard";
        if (closing && byUser && UNSAVED.has(closing)) {
          eventDetails.cancel();
          // Anchor under the tab: its offset within the (positioned) root.
          const tab = rootRef.current?.querySelector<HTMLElement>(`[data-tab="${closing}"]`);
          setAsking({
            value: closing,
            left: tab?.offsetLeft ?? 0,
            top: (tab?.offsetTop ?? 0) + (tab?.offsetHeight ?? 0) + 6,
          });
          return;
        }
        setItems(next);
      }}
      className="relative flex w-full flex-col gap-2 rounded-xl bg-[#f5f5f6] p-2 shadow-[0_0_0_1px_rgb(0_0_0/0.075),0_1px_2px_rgb(0_0_0/0.06),0_4px_8px_-2px_rgb(0_0_0/0.05)] dark:bg-[#131315] dark:shadow-[0_0_0_1px_rgb(0_0_0/0.16),0_1px_2px_rgb(0_0_0/0.1)] dark:after:pointer-events-none dark:after:absolute dark:after:inset-0 dark:after:z-50 dark:after:rounded-[inherit] dark:after:shadow-[inset_0_1px_0_rgb(255_255_255/0.05),inset_0_0_0_1px_rgb(255_255_255/0.06)]"
    >
      <Tabs.List aria-label="Documents" className="flex shrink-0 items-center gap-1">
        {(id) => (
          <Tabs.Trigger value={id} data-tab={id} className={tabClass}>
            <span className="min-w-0 truncate">{id}</span>
            {UNSAVED.has(id) ? (
              <span
                role="img"
                aria-label="Unsaved changes"
                className="size-1.5 shrink-0 rounded-full bg-zinc-400 dark:bg-zinc-500"
              />
            ) : null}
            <Tabs.Action className="absolute inset-y-0 right-1.5 flex items-center">
              <Tabs.Close
                aria-label={`Close ${id}`}
                className="grid size-5 shrink-0 cursor-pointer place-items-center rounded-full text-zinc-400 transition-colors hover:bg-zinc-950/5 hover:text-zinc-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0169cc]/60 dark:text-zinc-500 dark:hover:bg-white/8 dark:hover:text-zinc-100"
              >
                <CloseIcon />
              </Tabs.Close>
            </Tabs.Action>
          </Tabs.Trigger>
        )}
      </Tabs.List>

      <Tabs.Viewport className="flex h-24 items-center justify-center rounded-lg bg-white px-4 text-[13px] shadow-[0_0_0_1px_rgb(0_0_0/0.075),0_1px_2px_rgb(0_0_0/0.06),0_4px_8px_-2px_rgb(0_0_0/0.05)] dark:bg-zinc-900 dark:shadow-[inset_0_1px_0_rgb(255_255_255/0.05),inset_0_0_0_1px_rgb(255_255_255/0.06),0_0_0_1px_rgb(0_0_0/0.16),0_1px_2px_rgb(0_0_0/0.1)]">
        {(id) => <span className="text-zinc-500 dark:text-zinc-400">{id}</span>}
      </Tabs.Viewport>

      {asking ? <Prompt asking={asking} onAnswer={() => setAsking(null)} /> : null}
    </Tabs.Root>
  );
};

const tabClass = [
  "relative flex h-[30px] w-40 min-w-0 shrink cursor-pointer select-none items-center gap-2 overflow-hidden",
  // pr-7 reserves the close button's slot, so the label never runs under it.
  "rounded-md pr-7 pl-2.5 font-medium text-[13px] text-zinc-700 transition-colors dark:text-zinc-300",
  "hover:bg-zinc-950/5 dark:hover:bg-white/8",
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0169cc]/60",
  "data-[selected]:bg-white data-[selected]:bg-linear-to-b data-[selected]:from-white data-[selected]:to-[#fdfdfd] data-[selected]:text-zinc-900",
  "data-[selected]:shadow-[inset_0_1px_0_#fff,0_0_0_1px_rgb(0_0_0/0.075),0_1px_2px_rgb(0_0_0/0.07),0_2px_6px_-2px_rgb(0_0_0/0.05)]",
  "dark:data-[selected]:bg-[#2d2d30] dark:data-[selected]:from-[#313134] dark:data-[selected]:to-[#2a2a2d] dark:data-[selected]:text-zinc-100",
  "dark:data-[selected]:shadow-[inset_0_1px_0_rgb(255_255_255/0.1),inset_0_0_0_1px_rgb(255_255_255/0.05),0_0_0_1px_rgb(0_0_0/0.16),0_1px_2px_rgb(0_0_0/0.1)]",
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
