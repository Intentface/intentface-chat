"use client";

import { Tabs } from "@intentface/chat/tabs";
import { useState } from "react";
import "./hover-motion.css";
import { BubbleIcon, FileIcon } from "./icons";
import { Body, Preview, TABS } from "./pages";

/*
 * A page strip where any tab can be glanced at without leaving the page.
 *
 * The page is this component's own state, not the tabs' selection: pressing a
 * tab opens it in the card below. The tabs' selection is only what floats.
 * Hovering a tab floats a preview over the page, a document as a mini page and
 * a conversation as a small chat; press one and it becomes the page instead.
 *
 * `onValueChange` tells the two apart by `eventDetails.reason`. Click into the
 * reply field and the float stays, however far the mouse wanders; Escape or
 * pressing a tab ends it.
 */

export const Hover = () => {
  const [page, setPage] = useState("brief");
  const [floating, setFloating] = useState<string | null>(null);

  return (
    <div className="relative flex h-96 w-full flex-col overflow-hidden rounded-xl bg-[#f5f5f6] shadow-[0_0_0_1px_rgb(0_0_0/0.075),0_1px_2px_rgb(0_0_0/0.06),0_4px_8px_-2px_rgb(0_0_0/0.05)] dark:bg-[#131315] dark:shadow-[0_0_0_1px_rgb(0_0_0/0.16),0_1px_2px_rgb(0_0_0/0.1)] dark:after:pointer-events-none dark:after:absolute dark:after:inset-0 dark:after:z-50 dark:after:rounded-[inherit] dark:after:shadow-[inset_0_1px_0_rgb(255_255_255/0.05),inset_0_0_0_1px_rgb(255_255_255/0.06)]">
      <Tabs.Root
        defaultItems={Object.keys(TABS)}
        value={floating}
        onValueChange={(value, eventDetails) => {
          // A press opens the page in the layout and ends any float.
          if (eventDetails.reason === "trigger-press" && value !== null) {
            setPage(value);
            setFloating(null);
            return;
          }
          // Floating the page you are already on would show it twice, so nothing floats.
          setFloating(value === page ? null : value);
        }}
        className="flex min-h-0 flex-1 flex-col"
      >
        <Tabs.List aria-label="Open tabs" className="flex shrink-0 items-center gap-1 p-2">
          {(id) => {
            const tab = TABS[id];
            return (
              <Tabs.Trigger
                value={id}
                openOnHover
                aria-current={id === page ? "page" : undefined}
                className={tabClass}
              >
                <Tabs.Icon className="text-zinc-500 dark:text-zinc-400 [&>svg]:size-[15px] [&>svg]:shrink-0">
                  {tab?.kind === "conversation" ? <BubbleIcon /> : <FileIcon />}
                </Tabs.Icon>
                <span className="min-w-0 truncate">{tab?.name ?? id}</span>
              </Tabs.Trigger>
            );
          }}
        </Tabs.List>

        <div className="mx-2 mb-2 min-h-0 flex-1 overflow-auto rounded-lg bg-white shadow-[0_0_0_1px_rgb(0_0_0/0.075),0_1px_2px_rgb(0_0_0/0.06),0_4px_8px_-2px_rgb(0_0_0/0.05)] dark:bg-zinc-900 dark:shadow-[inset_0_1px_0_rgb(255_255_255/0.05),inset_0_0_0_1px_rgb(255_255_255/0.06),0_0_0_1px_rgb(0_0_0/0.16),0_1px_2px_rgb(0_0_0/0.1)]">
          <Body tab={TABS[page]} />
        </div>

        <Tabs.Portal>
          <Tabs.Positioner side="bottom" align="start" sideOffset={6}>
            <Tabs.Popup className="hover-demo-popup w-80 overflow-hidden rounded-xl bg-white p-1 shadow-[0_0_0_1px_rgb(0_0_0/0.075),0_1px_2px_rgb(0_0_0/0.06),0_12px_32px_-8px_rgb(0_0_0/0.16)] dark:bg-zinc-900 dark:shadow-[inset_0_1px_0_rgb(255_255_255/0.06),inset_0_0_0_1px_rgb(255_255_255/0.07),0_0_0_1px_rgb(0_0_0/0.16),0_12px_32px_-8px_rgb(0_0_0/0.4)]">
              <Tabs.Viewport>{(id) => <Preview tab={TABS[id]} />}</Tabs.Viewport>
            </Tabs.Popup>
          </Tabs.Positioner>
        </Tabs.Portal>
      </Tabs.Root>
    </div>
  );
};

const tabClass = [
  "relative flex h-[30px] max-w-48 shrink-0 cursor-pointer select-none items-center gap-1.5 overflow-hidden",
  "rounded-md px-2.5 font-medium text-[13px] text-zinc-700 transition-[background-color,color] duration-200 dark:text-zinc-300",
  "hover:bg-zinc-950/5 dark:hover:bg-white/8",
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0169cc]/60",
  // The page you are on, which this demo marks itself with aria-current.
  "aria-[current=page]:bg-white aria-[current=page]:bg-linear-to-b aria-[current=page]:from-white aria-[current=page]:to-[#fdfdfd] aria-[current=page]:text-zinc-900",
  "aria-[current=page]:shadow-[inset_0_1px_0_#fff,0_0_0_1px_rgb(0_0_0/0.075),0_1px_2px_rgb(0_0_0/0.07),0_2px_6px_-2px_rgb(0_0_0/0.05)]",
  "dark:aria-[current=page]:bg-[#2d2d30] dark:aria-[current=page]:from-[#313134] dark:aria-[current=page]:to-[#2a2a2d] dark:aria-[current=page]:text-zinc-100",
  "dark:aria-[current=page]:shadow-[inset_0_1px_0_rgb(255_255_255/0.1),inset_0_0_0_1px_rgb(255_255_255/0.05),0_0_0_1px_rgb(0_0_0/0.16),0_1px_2px_rgb(0_0_0/0.1)]",
  // The floating tab is the tabs' selection, and keeps its hover colour while you are over the surface.
  "data-[selected]:bg-zinc-950/5 data-[selected]:text-zinc-900 dark:data-[selected]:bg-white/8 dark:data-[selected]:text-zinc-100",
].join(" ");
