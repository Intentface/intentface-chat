import { ArrowUp, ArrowUpRight, Link } from "@keyline-icons/react";
import { BubbleIcon } from "./icons";

// A document is a few Markdown-ish blocks; a conversation is the exchange.
type Block = { kind: "p" | "h2" | "li"; text: string };

export type Tab =
  | { name: string; kind: "document"; blocks: Block[] }
  | { name: string; kind: "conversation"; lines: string[] };

export const TABS: Record<string, Tab> = {
  brief: {
    name: "Launch brief",
    kind: "document",
    blocks: [
      { kind: "p", text: "Ship the beta to the waitlist on the 14th." },
      { kind: "h2", text: "Scope" },
      { kind: "li", text: "Invite-only, 500 seats" },
      { kind: "li", text: "Pricing stays as drafted" },
      { kind: "li", text: "Feedback through the in-app widget" },
      { kind: "h2", text: "Owners" },
      { kind: "p", text: "Design owns the launch page; engineering owns the waitlist email." },
    ],
  },
  roadmap: {
    name: "Roadmap",
    kind: "document",
    blocks: [
      { kind: "p", text: "What ships next, by quarter." },
      { kind: "h2", text: "Q4" },
      { kind: "li", text: "Offline drafts" },
      { kind: "li", text: "Shared views" },
      { kind: "h2", text: "Q1" },
      { kind: "li", text: "The public API" },
      { kind: "li", text: "Usage-based pricing" },
    ],
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

// The blocks at two sizes: the open page, and the preview's mini page.
const Blocks = ({ blocks, mini }: { blocks: Block[]; mini?: boolean }) => (
  <div className={mini ? "flex flex-col gap-1" : "flex flex-col gap-2"}>
    {blocks.map((block) =>
      block.kind === "h2" ? (
        <h2
          key={block.text}
          className={[
            "font-semibold text-zinc-900 dark:text-zinc-100",
            mini ? "pt-1.5 text-[11px]" : "pt-3 text-sm",
          ].join(" ")}
        >
          {block.text}
        </h2>
      ) : (
        <p
          key={block.text}
          className={[
            "text-zinc-700 dark:text-zinc-300",
            mini ? "text-[11px] leading-4" : "text-sm leading-[1.7]",
            block.kind === "li" &&
              "relative pl-3.5 before:absolute before:left-1 before:content-['•'] before:text-zinc-400",
          ]
            .filter(Boolean)
            .join(" ")}
        >
          {block.text}
        </p>
      ),
    )}
  </div>
);

export const Body = ({ tab }: { tab: Tab | undefined }) =>
  tab ? (
    <article className="px-8 py-6">
      <h1 className="mb-3 font-semibold text-base text-zinc-900 tracking-tight dark:text-zinc-100">
        {tab.name}
      </h1>
      {tab.kind === "document" ? (
        <Blocks blocks={tab.blocks} />
      ) : (
        tab.lines.map((line) => (
          <p key={line} className="mb-2 text-sm text-zinc-700 leading-[1.7] dark:text-zinc-300">
            {line}
          </p>
        ))
      )}
    </article>
  ) : null;

// What floats on hover: a document as a mini page, a conversation as a small chat.
export const Preview = ({ tab }: { tab: Tab | undefined }) =>
  tab?.kind === "document" ? <DocumentPreview tab={tab} /> : <Conversation tab={tab} />;

// A Notion-style mini page: the title with its actions, then the document cut
// off under a fade. As tall as a conversation, so the popup only glides between them.
const DocumentPreview = ({ tab }: { tab: Extract<Tab, { kind: "document" }> }) => (
  <div className="h-[221px] overflow-hidden px-4 pt-3 mask-[linear-gradient(to_bottom,black_70%,transparent)]">
    <div className="mb-2 flex items-center justify-between gap-2">
      <p className="truncate font-semibold text-base text-zinc-900 tracking-tight dark:text-zinc-100">
        {tab.name}
      </p>
      <div className="flex shrink-0 gap-0.5">
        <button type="button" aria-label={`Copy link to ${tab.name}`} className={actionClass}>
          <Link className="size-3.5" />
        </button>
        <button type="button" aria-label={`Open ${tab.name}`} className={actionClass}>
          <ArrowUpRight className="size-3.5" />
        </button>
      </div>
    </div>
    <Blocks blocks={tab.blocks} mini />
  </div>
);

const actionClass =
  "grid size-6 cursor-pointer place-items-center rounded-md text-zinc-500 hover:bg-zinc-950/5 hover:text-zinc-900 focus-visible:outline-2 focus-visible:outline-[#0169cc]/60 dark:text-zinc-400 dark:hover:bg-white/8 dark:hover:text-zinc-100";

// A small chat window: header, the exchange, and a composer-style reply field.
const Conversation = ({ tab }: { tab: Tab | undefined }) =>
  tab?.kind === "conversation" ? (
    <div className="flex flex-col">
      <div className="flex h-9 items-center gap-1.5 px-2.5">
        <BubbleIcon className="size-[15px] text-zinc-500 dark:text-zinc-400" />
        <p className="font-medium text-[13px] text-zinc-900 dark:text-zinc-100">{tab.name}</p>
      </div>
      {/* One height for every conversation: the popup only glides sideways
          between tabs instead of snapping taller or shorter mid-slide. */}
      <div className="flex h-36 flex-col gap-4 px-2.5 py-4">
        {tab.lines.map((line, index) => (
          <p
            key={line}
            className={[
              "text-sm leading-6",
              index % 2 === 0
                ? "max-w-[80%] self-end rounded-[20px] bg-white px-3.5 py-1.5 text-zinc-900 shadow-[0_0_0_1px_rgb(0_0_0/0.08),0_1px_2px_rgb(0_0_0/0.04)] dark:bg-zinc-800 dark:text-zinc-100 dark:shadow-[inset_0_1px_0_rgb(255_255_255/0.05),inset_0_0_0_1px_rgb(255_255_255/0.06),0_0_0_1px_rgb(0_0_0/0.16)]"
                : "text-zinc-700 dark:text-zinc-300",
            ].join(" ")}
          >
            {line}
          </p>
        ))}
      </div>
      {/* The focus ring sits on the card, so the input itself draws none. */}
      <div className="flex items-center gap-1 rounded-xl bg-white p-1 pl-2.5 shadow-[0_0_0_1px_rgb(0_0_0/0.08),0_1px_2px_-1px_rgb(0_0_0/0.08),0_6px_16px_-6px_rgb(0_0_0/0.1)] has-[input:focus-visible]:outline-2 has-[input:focus-visible]:outline-[#0169cc]/60 has-[input:focus-visible]:outline-offset-2 dark:bg-zinc-800 dark:shadow-[inset_0_1px_0_rgb(255_255_255/0.06),inset_0_0_0_1px_rgb(255_255_255/0.07),0_0_0_1px_rgb(0_0_0/0.2),0_1px_2px_rgb(0_0_0/0.12),0_6px_16px_-6px_rgb(0_0_0/0.22)]">
        <input
          aria-label={`Reply in ${tab.name}`}
          placeholder="Reply…"
          className="h-8 min-w-0 flex-1 bg-transparent text-sm text-zinc-900 outline-none placeholder:text-zinc-400 dark:text-zinc-100 dark:placeholder:text-zinc-500"
        />
        <button
          type="button"
          aria-label="Send reply"
          className="flex size-7 shrink-0 cursor-pointer items-center justify-center rounded-full bg-[#0169cc] bg-linear-to-b from-[oklch(57.2%_0.166_253.2)] to-[oklch(52.9%_0.173_255)] text-white shadow-[inset_0_1px_0_rgb(255_255_255/0.28),0_0_0_1px_oklch(46.5%_0.146_254.8),0_1px_2px_rgb(1_105_204/0.35)] focus-visible:outline-2 focus-visible:outline-[#0169cc]/60 focus-visible:outline-offset-2"
        >
          <ArrowUp className="size-[15px]" />
        </button>
      </div>
    </div>
  ) : null;
