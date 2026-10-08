import type { ReactNode } from "react";
import { ReferenceTable } from "./reference-table";

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
  <ReferenceTable columns={[{ label: "Key", width: "w-[30%]" }, { label: "Description" }]}>
    {rows.map((row) => (
      <tr key={row.keys} className="border-ink-primary/6 border-b last:border-0">
        <td className="px-4 py-3.5 align-top">
          <kbd className="inline-flex h-5 items-center rounded-[5px] bg-raised px-1.5 font-mono text-2xs text-ink-body shadow-raised">
            {row.keys}
          </kbd>
        </td>
        <td className="p-0 align-top text-ink-body leading-5">
          {/* One line, scrolling sideways with fading edges instead of wrapping. */}
          <div className="scroll-mask overflow-x-auto whitespace-nowrap px-4 py-3.5 [scrollbar-width:none]">
            {row.description}
          </div>
        </td>
      </tr>
    ))}
  </ReferenceTable>
);
