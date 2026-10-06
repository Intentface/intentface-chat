"use client";

import { Tabs, useTabs } from "@intentface/chat/tabs";
import { type ComponentProps, useState } from "react";

/*
 * Closing a tab with unsaved changes asks first.
 *
 * Every change arrives with `eventDetails`, and `eventDetails.cancel()` stops it
 * landing. The × and Delete report "close-press" and "keyboard", so cancelling
 * those keeps the tab while the prompt waits. Discard then calls `close()` from
 * code, which reports "imperative-action" and goes through.
 */

const DOCUMENTS = ["Brief", "Roadmap", "Notes"];
const UNSAVED = new Set(["Roadmap"]);

export const ConfirmClose = () => {
  const [items, setItems] = useState(DOCUMENTS);
  const [asking, setAsking] = useState<string | null>(null);

  return (
    <Tabs.Root
      items={items}
      defaultValue="Roadmap"
      selectOnClose="adjacent"
      onItemsChange={(next, eventDetails) => {
        const closing = items.find((id) => !next.includes(id));
        const byUser = eventDetails.reason === "close-press" || eventDetails.reason === "keyboard";
        if (closing && byUser && UNSAVED.has(closing)) {
          eventDetails.cancel();
          setAsking(closing);
          return;
        }
        setItems(next);
      }}
      className="flex w-full flex-col gap-1.5"
    >
      <Tabs.List aria-label="Documents" className="flex shrink-0 items-center gap-1">
        {(id) => (
          <Tabs.Trigger value={id} className={tabClass}>
            <span className="min-w-0 truncate">{id}</span>
            {UNSAVED.has(id) ? (
              <span
                role="img"
                aria-label="Unsaved changes"
                className="size-1.5 shrink-0 rounded-full bg-[#949494] dark:bg-[#6f6f6f]"
              />
            ) : null}
            <Tabs.Action className="absolute inset-y-0 right-1.5 flex items-center">
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

      <Tabs.Viewport className="flex h-24 items-center justify-center rounded-xl border border-[#f0f0f0] bg-white px-4 text-sm dark:border-[#262626] dark:bg-[#111111]">
        {(id) => <span className="text-[#686868] dark:text-[#9b9b9b]">{id}</span>}
      </Tabs.Viewport>

      {asking ? <Prompt value={asking} onAnswer={() => setAsking(null)} /> : null}
    </Tabs.Root>
  );
};

/** Inside the Root, so Discard can close the tab the same way any code would. */
const Prompt = ({ value, onAnswer }: { value: string; onAnswer: () => void }) => {
  const close = useTabs((tabs) => tabs.close);

  return (
    <div role="alert" className="flex items-center gap-3 px-1 text-sm">
      <span className="text-[#1a1a1a] dark:text-[#fcfcfc]">{`Discard your changes to ${value}?`}</span>
      <button
        type="button"
        onClick={() => {
          onAnswer();
          close(value);
        }}
        className={buttonClass}
      >
        Discard
      </button>
      <button type="button" onClick={onAnswer} className={buttonClass}>
        Keep
      </button>
    </div>
  );
};

const tabClass = [
  "relative flex h-8 w-40 shrink-0 cursor-pointer select-none items-center gap-2 overflow-hidden",
  // pr-7 reserves the close button's slot, so the label never runs under it.
  "rounded-lg pr-7 pl-2.5 text-[#686868] text-sm transition-colors dark:text-[#9b9b9b]",
  "hover:bg-[#e7e7e7] dark:hover:bg-[#262626]",
  "focus-visible:-outline-offset-2 focus-visible:outline-2 focus-visible:outline-[#1a1a1a] dark:focus-visible:outline-[#fcfcfc]",
  "data-[selected]:bg-white data-[selected]:text-[#1a1a1a] data-[selected]:shadow-[0_1px_2px_rgba(0,0,0,0.06)]",
  "dark:data-[selected]:bg-[#2d2d2d] dark:data-[selected]:text-[#fcfcfc]",
].join(" ");

const buttonClass =
  "h-7 cursor-pointer rounded-md border border-[#e7e7e7] px-2.5 text-[#1a1a1a] text-xs transition-colors hover:bg-[#f4f4f4] dark:border-[#3d3d3d] dark:text-[#fcfcfc] dark:hover:bg-[#262626]";

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
