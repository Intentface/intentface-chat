import type { ReactNode } from "react";
import { ReferenceTable } from "./reference-table";
import { ScrollLine } from "./scroll-line";

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
  <ReferenceTable columns={[{ label: "Value", width: "w-[30%]" }, { label: "Description" }]}>
    {rows.map((row) => (
      <tr key={row.value} className="border-ink-primary/6 border-b last:border-0">
        <td className="px-4 py-3.5 align-top">
          <div className="flex flex-wrap items-center gap-2">
            <code className="font-medium font-mono text-ink-primary text-sm">{row.value}</code>
            {row.default ? (
              <span className="flex h-[18px] items-center rounded-[5px] bg-accent-bg/10 px-1.5 font-medium text-2xs text-accent-bg dark:bg-accent-bg/15">
                default
              </span>
            ) : null}
          </div>
        </td>
        <td className="p-0 align-top text-ink-body leading-5">
          <ScrollLine label={`${row.value}: description`}>{row.description}</ScrollLine>
        </td>
      </tr>
    ))}
  </ReferenceTable>
);
