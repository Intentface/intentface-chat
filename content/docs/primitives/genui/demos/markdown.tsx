"use client";

import {
  type BoundData,
  defaultCatalog,
  defineCatalog,
  toMarkdown,
  type UnboundPiece,
} from "@intentface/chat/genui";
import { defineComponents, GenUi } from "@intentface/chat/genui-render";
import { useState } from "react";

/*
 * One spec, two readers. On the left it is drawn, as a person sees it; on the
 * right is the Markdown the same spec turns into wherever it can't be drawn:
 * a clipboard, a search index, an agent reading a stored document. Every
 * catalog entry provides its Markdown, so nothing a model shows vanishes when
 * there are no pixels.
 *
 * The table's rows aren't in the spec: they are bound to a saved query by
 * `$data`, and the host fetches them. "Not loaded yet" shows the spec before
 * that has happened. Drawn, the `Unbound` slot says where the rows come from;
 * in Markdown, `onUnbound` writes the same. Leaving the table out would read
 * as "there is no data", which is a wrong answer, not an absent one.
 *
 * `locale` and `timeZone` are pinned: Markdown written on a server is stored
 * and indexed, and must not change with the machine that wrote it.
 */
const catalog = defineCatalog({
  version: defaultCatalog.version,
  elements: {
    Card: defaultCatalog.elements.Card,
    Metric: defaultCatalog.elements.Metric,
    DataTable: defaultCatalog.elements.DataTable,
  },
});

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

// What the host fetched for the binding, filed by where it sits in the spec.
const rows: BoundData = {
  "elements.paid.props.rows": [
    ["Bath", 1200],
    ["York", 950],
  ],
};

const unbound = (piece: UnboundPiece) => `_The table is read from ${piece.refs.join(", ")}._`;

const muted = "text-[#686868] text-xs dark:text-[#9b9b9b]";

const components = defineComponents(catalog, {
  elements: {
    Card: ({ title, children }) => (
      <section className="flex flex-col gap-3">
        {title ? <h3 className="font-medium text-sm">{title}</h3> : null}
        {children}
      </section>
    ),
    Metric: ({ label, text, delta }) => (
      <div>
        <div className={muted}>{label}</div>
        <div className="font-medium text-lg tabular-nums">
          {text}
          {delta ? <span className="ml-2 text-[#2f8a4a] text-xs">{delta.text}</span> : null}
        </div>
      </div>
    ),
    DataTable: ({ columns, rows }) => (
      <table className="w-full text-left text-sm">
        <thead className={muted}>
          <tr>
            {columns.map((column) => (
              <th
                className={`py-1 font-normal ${column.align === "right" ? "text-right" : ""}`}
                key={column.key}
              >
                {column.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr className="border-[#f0f0f0] border-t dark:border-[#262626]" key={row.key}>
              {row.cells.map((cell, index) => (
                <td
                  className={`py-1.5 tabular-nums ${columns[index]?.align === "right" ? "text-right" : ""}`}
                  key={columns[index]?.key}
                >
                  {cell.text}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    ),
  },
  // A piece whose bound data hasn't arrived: say where it comes from.
  Unbound: ({ refs }) => (
    <div
      className={`rounded-lg border border-[#e5e5e5] border-dashed p-3 dark:border-[#333333] ${muted}`}
    >
      Rows from {refs.join(", ")}, not loaded yet
    </div>
  ),
});

const Option = ({
  pressed,
  onClick,
  children,
}: {
  pressed: boolean;
  onClick: () => void;
  children: string;
}) => (
  <button
    aria-pressed={pressed}
    className={`rounded-md px-2.5 py-1 ${pressed ? "bg-white shadow-sm dark:bg-[#2a2a2a]" : "text-[#686868] dark:text-[#9b9b9b]"}`}
    onClick={onClick}
    type="button"
  >
    {children}
  </button>
);

export const MarkdownExport = () => {
  const [loaded, setLoaded] = useState(true);
  const data = loaded ? rows : undefined;
  const markdown = toMarkdown(spec, { data, onUnbound: unbound, locale: "en-GB", timeZone: "UTC" });

  return (
    <div className="flex w-full max-w-2xl flex-col gap-3">
      <div
        aria-label="The table's rows"
        className="flex gap-0.5 self-start rounded-lg bg-[#f0f0f0] p-0.5 text-xs dark:bg-[#1f1f1f]"
        role="group"
      >
        <Option onClick={() => setLoaded(true)} pressed={loaded}>
          Rows loaded
        </Option>
        <Option onClick={() => setLoaded(false)} pressed={!loaded}>
          Not loaded yet
        </Option>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <figure className="flex flex-col gap-1.5">
          <figcaption className={muted}>On screen</figcaption>
          <div className="h-full rounded-xl border border-[#f0f0f0] bg-white p-4 dark:border-[#262626] dark:bg-[#181818]">
            <GenUi.Root catalog={catalog} components={components} locale="en-GB" timeZone="UTC">
              <GenUi.Spec data={data} input={spec} />
            </GenUi.Root>
          </div>
        </figure>
        <figure className="flex flex-col gap-1.5">
          <figcaption className={muted}>As Markdown</figcaption>
          <pre className="h-full overflow-x-auto whitespace-pre-wrap rounded-xl border border-[#f0f0f0] bg-[#fafafa] p-4 text-xs leading-relaxed dark:border-[#262626] dark:bg-[#111111]">
            {markdown}
          </pre>
        </figure>
      </div>
    </div>
  );
};
