"use client";

import { defaultCatalog, defineCatalog, formatValue } from "@intentface/chat/genui";
import { GenUi, type GenUiComponents } from "@intentface/chat/genui-render";
import type { ReactNode } from "react";

/*
 * A spec, drawn. The package reads it — which elements exist, which props
 * parse, what goes inside what — and every pixel comes from the components
 * below. Swap them and the same spec takes on another product's look; that is
 * also why a stored spec re-skins itself when the theme changes.
 *
 * The catalog is narrowed to the four elements this page draws: a catalog is
 * plain data, and the component map is typed against it, so leaving one of
 * the four out of `components` is a type error rather than a gap on screen.
 */
const catalog = defineCatalog({
  version: defaultCatalog.version,
  elements: {
    Card: defaultCatalog.elements.Card,
    Grid: defaultCatalog.elements.Grid,
    Metric: defaultCatalog.elements.Metric,
    DataTable: defaultCatalog.elements.DataTable,
  },
});

// What a model writes: a flat list, parents before children, each naming its id.
const spec = {
  root: "card",
  elements: [
    { id: "card", type: "Card", props: { title: "Pipeline" }, children: ["grid", "deals"] },
    { id: "grid", type: "Grid", props: { columns: 2 }, children: ["total", "won"] },
    {
      id: "total",
      type: "Metric",
      props: { label: "Open", value: 240000, format: "currency", currency: "EUR", delta: 8 },
    },
    { id: "won", type: "Metric", props: { label: "Win rate", value: 31, format: "percent" } },
    {
      id: "deals",
      type: "DataTable",
      props: {
        columns: [
          { label: "Account" },
          { label: "Stage" },
          { label: "Value", format: "currency", currency: "EUR" },
        ],
        rows: [
          ["Northwind", "Proposal", 42000],
          ["Globex", "Discovery", 18500],
          ["Initech", "Negotiation", 67000],
        ],
      },
    },
  ],
};

const components: GenUiComponents<typeof catalog> = {
  elements: {
    Card: ({ title, children }: { title?: string; children?: ReactNode }) => (
      <section className="flex w-full max-w-xl flex-col gap-4 rounded-xl border border-[#f0f0f0] bg-white p-4 dark:border-[#262626] dark:bg-[#181818]">
        {title ? <h3 className="font-medium text-sm">{title}</h3> : null}
        {children}
      </section>
    ),
    Grid: ({ columns, children }) => (
      <div className="grid gap-3" style={{ gridTemplateColumns: `repeat(${columns}, 1fr)` }}>
        {children}
      </div>
    ),
    Metric: ({ label, value, format, currency, delta }) => (
      <div className="rounded-lg bg-[#fafafa] p-3 dark:bg-[#111111]">
        <div className="text-[#686868] text-xs dark:text-[#9b9b9b]">{label}</div>
        <div className="font-medium text-lg tabular-nums">
          {formatValue(value, format, currency)}
          {delta === undefined ? null : (
            <span className="ml-2 text-[#2f8a4a] text-xs">+{delta}%</span>
          )}
        </div>
      </div>
    ),
    DataTable: ({ columns, rows }) => (
      <table className="w-full text-left text-sm">
        <thead className="text-[#686868] text-xs dark:text-[#9b9b9b]">
          <tr>
            {columns.map((column) => (
              <th className="py-1 font-normal" key={column.label}>
                {column.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr className="border-[#f0f0f0] border-t dark:border-[#262626]" key={String(row[0])}>
              {columns.map((column, index) => (
                <td className="py-1.5 tabular-nums" key={column.label}>
                  {formatValue(row[index], column.format, column.currency)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    ),
  },
};

export const Basic = () => (
  <GenUi.Root catalog={catalog} components={components}>
    <GenUi.Spec input={spec} />
  </GenUi.Root>
);
