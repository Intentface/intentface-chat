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
// "default" to defer), so it stays inline. The Values column is omitted when no
// row provides one (e.g. keyboard shortcut tables).
export const AttributesTable = ({ rows }: AttributesTableProps) => {
  const hasValues = rows.some((row) => row.values);

  return (
    <div className="not-prose my-6 overflow-hidden rounded-lg border border-secondary-border bg-primary-bg">
      <table className="w-full table-fixed border-collapse text-left text-sm">
        <colgroup>
          <col className="w-[28%]" />
          {hasValues ? <col className="w-[28%]" /> : null}
          <col className={hasValues ? "w-[44%]" : "w-[72%]"} />
        </colgroup>
        <thead>
          <tr className="border-secondary-border border-b bg-tertiary-bg">
            <th className="px-4 py-2.5 font-medium text-ink-primary">Attribute</th>
            {hasValues ? (
              <th className="px-4 py-2.5 font-medium text-ink-primary">Values</th>
            ) : null}
            <th className="px-4 py-2.5 font-medium text-ink-primary">Description</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.attribute} className="border-secondary-border/60 border-b last:border-0">
              <td className="px-4 py-2.5 align-top">
                <code className="font-mono text-ink-primary text-xs">{row.attribute}</code>
              </td>
              {hasValues ? (
                <td className="px-4 py-2.5 align-top">
                  {row.values ? (
                    <code className="wrap-break-word font-mono text-accent-bg text-xs">
                      {row.values}
                    </code>
                  ) : (
                    <span className="text-ink-tertiary">—</span>
                  )}
                </td>
              ) : null}
              <td className="px-4 py-2.5 align-top text-ink-secondary">{row.description}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};
