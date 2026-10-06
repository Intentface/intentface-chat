"use client";

import { Tabs } from "@intentface/chat/tabs";
import { type ComponentProps, useState } from "react";

/*
 * A page strip where a conversation can be glanced at without leaving the page.
 *
 * The page is this component's own state, not the tabs' selection: pressing a
 * tab opens it in the card below. The tabs' selection is only what floats.
 * Conversations open on hover and float over the page; press one and it
 * becomes the page instead.
 *
 * `onValueChange` tells the two apart by `eventDetails.reason`. Click into the
 * reply field and the float stays, however far the mouse wanders; Escape or
 * pressing a tab ends it.
 */

type Tab = { name: string; kind: "document" | "conversation"; lines: string[] };

const TABS: Record<string, Tab> = {
  brief: {
    name: "Launch brief",
    kind: "document",
    lines: ["Ship the beta to the waitlist on the 14th.", "Pricing stays as drafted."],
  },
  roadmap: {
    name: "Roadmap",
    kind: "document",
    lines: ["Q4: offline drafts, shared views.", "Q1: the public API."],
  },
  "chat-launch": {
    name: "Launch questions",
    kind: "conversation",
    lines: ["Is the 14th still realistic?", "Yes, if the waitlist email goes out on the 12th."],
  },
  "chat-pricing": {
    name: "Pricing check",
    kind: "conversation",
    lines: ["Do we discount annual plans?", "Two months free, same as last year."],
  },
};

export const Hover = () => {
  const [page, setPage] = useState("brief");
  const [floating, setFloating] = useState<string | null>(null);

  return (
    <div className="flex h-96 w-full flex-col overflow-hidden rounded-xl border border-[#f0f0f0] bg-[#fafafa] dark:border-[#262626] dark:bg-[#111111]">
      <HoverMotion />
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
                openOnHover={tab?.kind === "conversation"}
                aria-current={id === page ? "page" : undefined}
                className={tabClass}
              >
                <Tabs.Icon className="[&>svg]:size-4 [&>svg]:shrink-0 [&>svg]:opacity-60">
                  {tab?.kind === "conversation" ? <BubbleIcon /> : <FileIcon />}
                </Tabs.Icon>
                <span className="min-w-0 truncate">{tab?.name ?? id}</span>
              </Tabs.Trigger>
            );
          }}
        </Tabs.List>

        <div className="mx-2 mb-2 min-h-0 flex-1 overflow-auto rounded-md border border-[#f0f0f0] bg-white dark:border-[#262626] dark:bg-[#181818]">
          <Body tab={TABS[page]} />
        </div>

        <Tabs.Portal>
          <Tabs.Positioner side="bottom" align="start" sideOffset={6}>
            <Tabs.Popup className="hover-demo-popup w-80 overflow-hidden rounded-xl border border-[#f0f0f0] bg-white shadow-lg dark:border-[#262626] dark:bg-[#181818]">
              <Tabs.Viewport>{(id) => <Conversation tab={TABS[id]} />}</Tabs.Viewport>
            </Tabs.Popup>
          </Tabs.Positioner>
        </Tabs.Portal>
      </Tabs.Root>
    </div>
  );
};

const Body = ({ tab }: { tab: Tab | undefined }) =>
  tab ? (
    <article className="px-8 py-6">
      <h1 className="mb-4 font-semibold text-[#1a1a1a] text-xl tracking-tight dark:text-[#fcfcfc]">
        {tab.name}
      </h1>
      {tab.lines.map((line) => (
        <p key={line} className="mb-2 text-[#686868] text-sm leading-[1.7] dark:text-[#9b9b9b]">
          {line}
        </p>
      ))}
    </article>
  ) : null;

const Conversation = ({ tab }: { tab: Tab | undefined }) =>
  tab ? (
    <div className="flex flex-col gap-3 p-3">
      <p className="font-medium text-[#1a1a1a] text-sm dark:text-[#fcfcfc]">{tab.name}</p>
      {tab.lines.map((line, index) => (
        <p
          key={line}
          className={[
            "max-w-[85%] rounded-lg px-2.5 py-1.5 text-sm",
            index % 2 === 0
              ? "self-end bg-[#f4f4f4] text-[#1a1a1a] dark:bg-[#232323] dark:text-[#fcfcfc]"
              : "text-[#686868] dark:text-[#9b9b9b]",
          ].join(" ")}
        >
          {line}
        </p>
      ))}
      <input
        aria-label={`Reply in ${tab.name}`}
        placeholder="Reply…"
        className="h-8 rounded-md border border-[#f0f0f0] bg-transparent px-2.5 text-sm outline-none focus:border-[#c4c4c4] dark:border-[#262626] dark:focus:border-[#4a4a4a]"
      />
    </div>
  ) : null;

/* The surface fades and drops in; the switch between floating tabs is the
   positioner moving, so it only needs the top/left transition. */
const HoverMotion = () => (
  <style>{`
[data-tabs-positioner]:has(> .hover-demo-popup) { transition: top 150ms ease-out, left 150ms ease-out; }
.hover-demo-popup { transition: opacity 150ms ease-out, transform 150ms ease-out; }
.hover-demo-popup[data-starting-style], .hover-demo-popup[data-ending-style] { opacity: 0; transform: translateY(-4px); }
@media (prefers-reduced-motion: reduce) {
  [data-tabs-positioner]:has(> .hover-demo-popup), .hover-demo-popup { transition: none; }
}
`}</style>
);

const tabClass = [
  "relative flex h-7 max-w-48 shrink-0 cursor-pointer select-none items-center gap-1.5 overflow-hidden",
  "rounded-md px-2.5 text-[#686868] text-sm transition-[background-color,color] duration-200 dark:text-[#9b9b9b]",
  "hover:bg-[#f4f4f4] dark:hover:bg-[#232323]",
  "focus-visible:-outline-offset-2 focus-visible:outline-2 focus-visible:outline-[#1a1a1a] dark:focus-visible:outline-[#fcfcfc]",
  // The page you are on, which this demo marks itself with aria-current.
  "border border-transparent aria-[current=page]:border-[#f0f0f0] aria-[current=page]:bg-white aria-[current=page]:text-[#1a1a1a]",
  "dark:aria-[current=page]:border-[#262626] dark:aria-[current=page]:bg-[#181818] dark:aria-[current=page]:text-[#fcfcfc]",
  // The floating tab is the tabs' selection, and keeps its hover colour while you are over the surface.
  "data-[selected]:bg-[#f4f4f4] data-[selected]:text-[#1a1a1a] dark:data-[selected]:bg-[#232323] dark:data-[selected]:text-[#fcfcfc]",
].join(" ");

const FileIcon = (props: ComponentProps<"svg">) => (
  <svg
    viewBox="0 0 16 16"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.3"
    aria-hidden="true"
    {...props}
  >
    <path d="M4 2h5l3 3v9H4V2Z" strokeLinejoin="round" />
    <path d="M9 2v3h3" strokeLinejoin="round" />
  </svg>
);

const BubbleIcon = (props: ComponentProps<"svg">) => (
  <svg
    viewBox="0 0 16 16"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.3"
    aria-hidden="true"
    {...props}
  >
    <path
      d="M2.5 4.5a2 2 0 0 1 2-2h7a2 2 0 0 1 2 2v4.5a2 2 0 0 1-2 2H7l-3 2.5v-2.5h0a2 2 0 0 1-1.5-2V4.5Z"
      strokeLinejoin="round"
    />
  </svg>
);
