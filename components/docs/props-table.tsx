import type { ReactNode } from "react";

export type PropRow = {
  name: string;
  type: string;
  default?: string;
  description: ReactNode;
};

type PropsTableProps = {
  rows: PropRow[];
};

// Hand-authored prop reference. Start manual per primitive; a type-driven
// generator can replace the data source later without changing this markup.
export const PropsTable = ({ rows }: PropsTableProps) => (
  <div className="not-prose my-6 overflow-x-auto rounded-lg border border-primary-border">
    <table className="w-full border-collapse text-left text-sm">
      <thead>
        <tr className="border-primary-border border-b bg-tertiary">
          <th className="px-4 py-2 font-medium text-ink-primary">Prop</th>
          <th className="px-4 py-2 font-medium text-ink-primary">Type</th>
          <th className="px-4 py-2 font-medium text-ink-primary">Default</th>
          <th className="px-4 py-2 font-medium text-ink-primary">Description</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={row.name} className="border-primary-border/60 border-b last:border-0">
            <td className="px-4 py-2 align-top">
              <code className="font-mono text-ink-primary text-xs">{row.name}</code>
            </td>
            <td className="px-4 py-2 align-top">
              <code className="font-mono text-accent text-xs">{row.type}</code>
            </td>
            <td className="px-4 py-2 align-top text-ink-tertiary">
              {row.default ? <code className="font-mono text-xs">{row.default}</code> : "—"}
            </td>
            <td className="px-4 py-2 align-top text-ink-secondary">{row.description}</td>
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);
