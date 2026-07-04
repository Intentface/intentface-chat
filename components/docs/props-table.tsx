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
const cell = "px-4 py-2.5 align-top";
const headCell = `${cell} font-medium text-ink-primary`;
const bodyCell = cell;

export const PropsTable = ({ rows }: PropsTableProps) => (
  <div className="not-prose my-6 overflow-x-auto rounded-lg border border-secondary-border">
    <table className="w-full border-collapse text-left text-sm">
      <thead>
        <tr className="border-secondary-border border-b bg-tertiary">
          <th className={headCell}>Prop</th>
          <th className={headCell}>Type</th>
          <th className={headCell}>Default</th>
          <th className={headCell}>Description</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={row.name} className="border-secondary-border/60 border-b last:border-0">
            <td className={bodyCell}>
              <code className="font-mono text-ink-primary text-xs">{row.name}</code>
            </td>
            <td className={bodyCell}>
              <code className="font-mono text-accent text-xs">{row.type}</code>
            </td>
            <td className={`${bodyCell} text-ink-tertiary`}>
              {row.default ? <code className="font-mono text-xs">{row.default}</code> : "—"}
            </td>
            <td className={`${bodyCell} text-ink-secondary`}>{row.description}</td>
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);
