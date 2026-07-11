import type { ReactNode } from "react";

export type ValueRow = {
  value: string;
  default?: boolean;
  description: ReactNode;
};

type ValuesTableProps = {
  rows: ValueRow[];
};

// Hand-authored enum-value reference — the allowed values of a single prop, with
// the default flagged by a badge (not a separate column, which would be empty on
// every other row). Fixed-width columns and chrome match PropsTable /
// AttributesTable so the tables stay visually aligned down the page.
export const ValuesTable = ({ rows }: ValuesTableProps) => (
  <div className="not-prose my-6 overflow-hidden rounded-lg border border-secondary-border">
    <table className="w-full table-fixed border-collapse text-left text-sm">
      <colgroup>
        <col className="w-[28%]" />
        <col className="w-[72%]" />
      </colgroup>
      <thead>
        <tr className="border-secondary-border border-b bg-tertiary-bg">
          <th className="px-4 py-2.5 font-medium text-ink-primary">Value</th>
          <th className="px-4 py-2.5 font-medium text-ink-primary">Description</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={row.value} className="border-secondary-border/60 border-b last:border-0">
            <td className="px-4 py-2.5 align-top">
              <div className="flex flex-wrap items-center gap-2">
                <code className="font-mono text-ink-primary text-xs">{row.value}</code>
                {row.default ? (
                  <span className="rounded border border-secondary-border bg-tertiary-bg px-1.5 py-px font-medium text-2xs text-ink-tertiary">
                    default
                  </span>
                ) : null}
              </div>
            </td>
            <td className="px-4 py-2.5 align-top text-ink-secondary">{row.description}</td>
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);
