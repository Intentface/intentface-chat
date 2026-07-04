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
// Sibling of PropsTable; same source-of-truth caveat (derive from the package,
// not from memory).
export const AttributesTable = ({ rows }: AttributesTableProps) => (
  <div className="not-prose my-6 overflow-x-auto rounded-lg border border-secondary-border">
    <table className="w-full border-collapse text-left text-sm">
      <thead>
        <tr className="border-secondary-border border-b bg-tertiary">
          <th className="px-4 py-2 font-medium text-ink-primary">Attribute</th>
          <th className="px-4 py-2 font-medium text-ink-primary">Values</th>
          <th className="px-4 py-2 font-medium text-ink-primary">Description</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={row.attribute} className="border-secondary-border/60 border-b last:border-0">
            <td className="px-4 py-2 align-top">
              <code className="font-mono text-ink-primary text-xs">{row.attribute}</code>
            </td>
            <td className="px-4 py-2 align-top text-ink-tertiary">
              {row.values ? (
                <code className="font-mono text-accent text-xs">{row.values}</code>
              ) : (
                "—"
              )}
            </td>
            <td className="px-4 py-2 align-top text-ink-secondary">{row.description}</td>
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);
