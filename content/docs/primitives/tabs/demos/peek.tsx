"use client";

import { Tabs } from "@intentface/chat/tabs";
import type { ComponentProps } from "react";

/*
 * A page strip where some tabs can be glanced at without leaving the page.
 *
 * The documents are ordinary tabs: pressing one shows it in the card below.
 * The conversations also peek — rest the pointer on one and it floats over the
 * page while the document stays selected underneath. Press it and it opens
 * for real, in the card, like any other tab.
 *
 * Two viewports in one Root are what make that possible: the selection's in
 * the layout, and the peek's inside `<Tabs.Portal peek>`. Click into the reply
 * field and the peek stays put however far the pointer wanders; Escape, a
 * press outside, or pressing its tab ends it.
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

export const Peek = () => (
  <div className="flex h-96 w-full flex-col overflow-hidden rounded-xl border border-[#f0f0f0] bg-[#fafafa] dark:border-[#262626] dark:bg-[#111111]">
    <PeekMotion />
    <Tabs.Root
      defaultItems={Object.keys(TABS)}
      defaultValue="brief"
      // A page strip always shows something, so Escape is left for the peek.
      dismissOnEscape={false}
      className="flex min-h-0 flex-1 flex-col"
    >
      <Tabs.List aria-label="Open tabs" className="flex shrink-0 items-center gap-1 p-2">
        {(id) => {
          const tab = TABS[id];
          return (
            <Tabs.Trigger
              value={id}
              peekOnHover={tab?.kind === "conversation"}
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

      <Tabs.Viewport className="mx-2 mb-2 min-h-0 flex-1 overflow-auto rounded-md border border-[#f0f0f0] bg-white dark:border-[#262626] dark:bg-[#181818]">
        {(id) => <Body tab={TABS[id]} />}
      </Tabs.Viewport>

      <Tabs.Portal peek>
        <Tabs.Positioner side="bottom" align="start" sideOffset={6}>
          <Tabs.Popup className="peek-demo-popup w-80 overflow-hidden rounded-xl border border-[#f0f0f0] bg-white shadow-lg dark:border-[#262626] dark:bg-[#181818]">
            <Tabs.Viewport>{(id) => <Conversation tab={TABS[id]} />}</Tabs.Viewport>
          </Tabs.Popup>
        </Tabs.Positioner>
      </Tabs.Portal>
    </Tabs.Root>
  </div>
);

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

/* The surface fades and drops in; the switch between peeked tabs is the
   positioner moving, so it only needs the top/left transition. */
const PeekMotion = () => (
  <style>{`
[data-tabs-positioner]:has(> .peek-demo-popup) { transition: top 150ms ease-out, left 150ms ease-out; }
.peek-demo-popup { transition: opacity 150ms ease-out, transform 150ms ease-out; }
.peek-demo-popup[data-starting-style], .peek-demo-popup[data-ending-style] { opacity: 0; transform: translateY(-4px); }
@media (prefers-reduced-motion: reduce) {
  [data-tabs-positioner]:has(> .peek-demo-popup), .peek-demo-popup { transition: none; }
}
`}</style>
);

const tabClass = [
  "relative flex h-7 max-w-48 shrink-0 cursor-pointer select-none items-center gap-1.5 overflow-hidden",
  "rounded-md px-2.5 text-[#686868] text-sm transition-[background-color,color] duration-200 dark:text-[#9b9b9b]",
  "hover:bg-[#f4f4f4] dark:hover:bg-[#232323]",
  "focus-visible:-outline-offset-2 focus-visible:outline-2 focus-visible:outline-[#1a1a1a] dark:focus-visible:outline-[#fcfcfc]",
  "border border-transparent data-[selected]:border-[#f0f0f0] data-[selected]:bg-white data-[selected]:text-[#1a1a1a]",
  "dark:data-[selected]:border-[#262626] dark:data-[selected]:bg-[#181818] dark:data-[selected]:text-[#fcfcfc]",
  // The peeked tab keeps its hover colour while you are over the surface.
  "data-[peeked]:bg-[#f4f4f4] data-[peeked]:text-[#1a1a1a] dark:data-[peeked]:bg-[#232323] dark:data-[peeked]:text-[#fcfcfc]",
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
