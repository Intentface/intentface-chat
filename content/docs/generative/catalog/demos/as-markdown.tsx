"use client";

import { markdown, tree, useTree } from "@intentface/chat/generative";
import { useState } from "react";
import { catalog } from "./catalog";
import { DrawNode } from "./draw";

/*
 * The same call as text, for wherever it can't be drawn: the model's own
 * history, a search index, a copy button. Each component writes its part
 * through its `markdown`, and a container writes its children's.
 *
 * `markdown.tree` takes a checked tree, so the call goes through `tree.validate`
 * first. Text the model wrote is escaped, so it can't format or link itself.
 */
const CALL = {
  root: "pipeline",
  elements: [
    {
      id: "pipeline",
      type: "Card",
      props: { title: "Pipeline" },
      children: ["value", "deals", "table"],
    },
    { id: "value", type: "Metric", props: { label: "Pipeline value", value: "€196,000" } },
    { id: "deals", type: "Metric", props: { label: "Open deals", value: "4" } },
    {
      id: "table",
      type: "Table",
      props: {
        columns: ["Company", "Stage", "Amount"],
        rows: [
          ["Aalto Labs", "Proposal", "€62,400"],
          ["Kide Systems", "Negotiation", "€88,000"],
          ["Lumo Oy", "Won", "€31,600"],
          ["Revontuli", "Qualified", "€14,000"],
        ],
      },
    },
  ],
};

type View = "component" | "markdown";

export const AsMarkdown = () => {
  const [view, setView] = useState<View>("component");
  const [text, setText] = useState("");
  // Views fade in from the first switch, so the page loads still.
  const [live, setLive] = useState(false);
  const { root } = useTree(CALL, catalog);

  const select = async (next: View) => {
    if (next === "markdown" && !text) {
      const result = await tree.validate(CALL, catalog);
      if (result.value) setText(markdown.tree(result.value, catalog));
    }
    setLive(true);
    setView(next);
  };

  return (
    <div
      data-live={live || undefined}
      className="flex w-full max-w-130 flex-col items-center gap-3"
    >
      <div className="min-h-82 w-full">
        {view === "markdown" ? (
          <pre className="overflow-x-auto rounded-xl bg-zinc-50 px-4.5 py-4 font-mono text-[12.5px] text-zinc-700 leading-5 shadow-[0_0_0_1px_rgb(0_0_0/0.06)] transition-[opacity,translate,filter] duration-400 ease-[cubic-bezier(0.22,1,0.36,1)] in-data-live:starting:translate-y-1 in-data-live:starting:opacity-0 in-data-live:starting:blur-[2px] motion-reduce:transition-none dark:bg-white/3 dark:text-zinc-300 dark:shadow-[inset_0_0_0_1px_rgb(255_255_255/0.06)]">
            {text}
          </pre>
        ) : root ? (
          <DrawNode node={root} />
        ) : null}
      </div>

      {/* The island: which view is showing. */}
      <div
        role="group"
        aria-label="View"
        className="flex items-center gap-0.5 rounded-full bg-zinc-100 p-0.5 dark:bg-white/6"
      >
        {(["component", "markdown"] as const).map((value) => (
          <button
            key={value}
            type="button"
            aria-pressed={view === value}
            onClick={() => select(value)}
            className="h-7 cursor-pointer rounded-full px-3 font-medium text-[13px] text-zinc-500 capitalize transition-[color,background-color,box-shadow] hover:text-zinc-900 focus-visible:outline-2 focus-visible:outline-[#0169cc]/60 focus-visible:outline-offset-2 aria-pressed:bg-white aria-pressed:text-zinc-900 aria-pressed:shadow-[inset_0_1px_0_#fff,0_0_0_1px_rgb(0_0_0/0.075),0_1px_2px_rgb(0_0_0/0.07),0_2px_6px_-2px_rgb(0_0_0/0.05)] dark:text-zinc-400 dark:aria-pressed:bg-[#2d2d30] dark:aria-pressed:text-zinc-100 dark:hover:text-zinc-100 dark:aria-pressed:shadow-[inset_0_1px_0_rgb(255_255_255/0.1),inset_0_0_0_1px_rgb(255_255_255/0.05),0_0_0_1px_rgb(0_0_0/0.16),0_1px_2px_rgb(0_0_0/0.1)]"
          >
            {value}
          </button>
        ))}
      </div>
    </div>
  );
};
