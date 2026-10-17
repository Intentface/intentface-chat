"use client";

import { type BoundData, toMarkdown, type UnboundPiece } from "@intentface/chat/genui";
import { useState } from "react";

/*
 * The same spec as Markdown — what it reads as wherever it can't be drawn: a
 * clipboard, a search index, a document an agent reads later, an MCP client.
 * Every catalog entry has to provide this, so nothing a model shows vanishes
 * when there are no pixels.
 *
 * The table's rows are bound (`$data`), not copied. With the data resolved
 * they are written out; without it, `onUnbound` decides what the table reads
 * as. Left out, a later reader would take the missing table for "there is no
 * data" — a wrong answer, not an absent one — so a stored document says where
 * the data lives instead.
 *
 * `locale` and `timeZone` are pinned: Markdown written on a server is stored
 * and indexed, and must not change with the machine that wrote it.
 */
const spec = {
  root: "card",
  elements: [
    { id: "card", type: "Card", props: { title: "Branches" }, children: ["total", "paid"] },
    {
      id: "total",
      type: "Metric",
      props: { label: "Paid this month", value: 2150, format: "number", delta: 4 },
    },
    {
      id: "paid",
      type: "DataTable",
      props: {
        columns: [{ label: "Branch" }, { label: "Paid", format: "number" }],
        rows: { $data: "queries/paid-by-branch", columns: ["branch", "paid"] },
      },
    },
  ],
};

// Filed by where the binding sits in the spec, which is how a resolver returns them.
const data: BoundData = {
  "elements.paid.props.rows": [
    ["Bath", 1200],
    ["York", 950],
  ],
};

const unbound = (piece: UnboundPiece) =>
  `_The ${piece.type === "DataTable" ? "table" : piece.type} is read from ${piece.refs.join(", ")}._`;

export const MarkdownExport = () => {
  const [resolved, setResolved] = useState(false);
  const markdown = toMarkdown(spec, {
    data: resolved ? data : undefined,
    onUnbound: unbound,
    locale: "en-GB",
    timeZone: "UTC",
  });

  return (
    <div className="flex w-full max-w-xl flex-col gap-3">
      <label className="flex items-center gap-2 text-sm">
        <input
          checked={resolved}
          onChange={(event) => setResolved(event.target.checked)}
          type="checkbox"
        />
        Data resolved
      </label>
      <pre className="overflow-x-auto rounded-xl border border-[#f0f0f0] bg-[#fafafa] p-4 text-xs leading-relaxed dark:border-[#262626] dark:bg-[#111111]">
        {markdown}
      </pre>
    </div>
  );
};
