import type { ReactNode } from "react";

export type KeyRow = {
  /** The key or chord, as a reader would press it: "Arrow up", "Enter / Space". */
  keys: string;
  description: ReactNode;
};

type KeysTableProps = {
  rows: KeyRow[];
};

// Keyboard reference. Its own table rather than ValuesTable's: a key is not a
// prop value, so it wants a "Key" header, <kbd> instead of <code>, and no
// `default` badge — there is no such thing as a default keystroke. Column
// widths and chrome match the other tables so they stay aligned down the page.
export const KeysTable = ({ rows }: KeysTableProps) => (
  <div className="not-prose my-6 overflow-hidden rounded-lg border border-secondary-border bg-primary-bg">
    <table className="w-full table-fixed border-collapse text-left text-sm">
      <colgroup>
        <col className="w-[28%]" />
        <col className="w-[72%]" />
      </colgroup>
      <thead>
        <tr className="border-secondary-border border-b bg-tertiary-bg">
          <th className="px-4 py-2.5 font-medium text-ink-primary">Key</th>
          <th className="px-4 py-2.5 font-medium text-ink-primary">Description</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={row.keys} className="border-secondary-border/60 border-b last:border-0">
            <td className="px-4 py-2.5 align-top">
              <kbd className="rounded border border-secondary-border bg-tertiary-bg px-1.5 py-0.5 font-sans text-ink-primary text-xs">
                {row.keys}
              </kbd>
            </td>
            <td className="px-4 py-2.5 align-top text-ink-secondary">{row.description}</td>
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);
