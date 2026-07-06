import type { ReactNode } from "react";

export type AttributeRow = {
  attribute: string;
  values?: string;
  description: ReactNode;
};

type AttributesTableProps = {
  rows: AttributeRow[];
};

// Hand-authored data-attribute reference — the styling hooks a part emits.
// Fixed-width columns match PropsTable so the two stay visually aligned down the
// page. Not collapsible: the description is the essential content here (no
// "default" to defer), so it stays inline.
export const AttributesTable = ({ rows }: AttributesTableProps) => (
  <div className="not-prose my-6 overflow-hidden rounded-lg border border-secondary-border">
    <table className="w-full table-fixed border-collapse text-left text-sm">
      <colgroup>
        <col className="w-[28%]" />
        <col className="w-[28%]" />
        <col className="w-[44%]" />
      </colgroup>
      <thead>
        <tr className="border-secondary-border border-b bg-tertiary">
          <th className="px-4 py-2.5 font-medium text-ink-primary">Attribute</th>
          <th className="px-4 py-2.5 font-medium text-ink-primary">Values</th>
          <th className="px-4 py-2.5 font-medium text-ink-primary">Description</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={row.attribute} className="border-secondary-border/60 border-b last:border-0">
            <td className="px-4 py-2.5 align-top">
              <code className="font-mono text-ink-primary text-xs">{row.attribute}</code>
            </td>
            <td className="px-4 py-2.5 align-top">
              {row.values ? (
                <code className="break-words font-mono text-accent text-xs">{row.values}</code>
              ) : (
                <span className="text-ink-tertiary">—</span>
              )}
            </td>
            <td className="px-4 py-2.5 align-top text-ink-secondary">{row.description}</td>
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);
