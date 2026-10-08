import type { ReactNode } from "react";

type Column = {
  label: string;
  /** A width class for the column, e.g. "w-[30%]". Omit for the flexible column. */
  width?: string;
  /** Screen-reader only label (e.g. the expand-toggle column). */
  srOnly?: boolean;
};

/**
 * The frame every API reference table shares, built two-tone like a code block:
 * column labels sit in an outer tray and the rows in an inset panel with its own
 * edge. An expanded row takes the tray colour, so it reads as part of the frame.
 * The visual header is a separate, hidden table on the same column widths; the
 * real <thead> lives with the rows for assistive tech.
 */
export const ReferenceTable = ({
  columns,
  children,
}: {
  columns: Column[];
  children: ReactNode;
}) => {
  const colgroup = (
    <colgroup>
      {columns.map((column) => (
        <col key={column.label} className={column.width} />
      ))}
    </colgroup>
  );

  return (
    <div className="not-prose my-6 rounded-xl bg-table-tray p-[5px] shadow-card">
      <table aria-hidden="true" className="w-full table-fixed text-left">
        {colgroup}
        <tbody>
          <tr>
            {columns.map((column) => (
              <td
                key={column.label}
                className="h-[31px] px-4 pb-[5px] align-middle font-medium text-ink-secondary text-xs"
              >
                {column.srOnly ? null : column.label}
              </td>
            ))}
          </tr>
        </tbody>
      </table>
      <div className="relative overflow-hidden rounded-md bg-table-panel shadow-[0_0_0_1px_rgb(0_0_0/0.06),0_1px_2px_rgb(0_0_0/0.04)] dark:shadow-none dark:after:pointer-events-none dark:after:absolute dark:after:inset-0 dark:after:rounded-md dark:after:shadow-[inset_0_0_0_1px_rgb(255_255_255/0.07)]">
        {/* Dark draws its edge on an overlay: an inset shadow sits under the rows,
            so an expanded row's background would paint over it. */}
        <table className="w-full table-fixed border-collapse text-left text-sm">
          {colgroup}
          <thead className="sr-only">
            <tr>
              {columns.map((column) => (
                <th key={column.label}>{column.label}</th>
              ))}
            </tr>
          </thead>
          <tbody>{children}</tbody>
        </table>
      </div>
    </div>
  );
};
