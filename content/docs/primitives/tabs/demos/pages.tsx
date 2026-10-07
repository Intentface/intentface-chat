import { ArrowUp } from "@keyline-icons/react";
import { BubbleIcon } from "./icons";

export type Tab = { name: string; kind: "document" | "conversation"; lines: string[] };

export const TABS: Record<string, Tab> = {
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

export const Body = ({ tab }: { tab: Tab | undefined }) =>
  tab ? (
    <article className="px-8 py-6">
      <h1 className="mb-3 font-semibold text-base text-zinc-900 tracking-tight dark:text-zinc-100">
        {tab.name}
      </h1>
      {tab.lines.map((line) => (
        <p key={line} className="mb-2 text-sm text-zinc-700 leading-[1.7] dark:text-zinc-300">
          {line}
        </p>
      ))}
    </article>
  ) : null;

// A small chat window: header, the exchange, and a composer-style reply field.
export const Conversation = ({ tab }: { tab: Tab | undefined }) =>
  tab ? (
    <div className="flex flex-col">
      <div className="flex h-9 items-center gap-1.5 border-zinc-950/6 border-b px-2.5 dark:border-white/6">
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
