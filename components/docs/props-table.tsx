"use client";

import { ChevronDown } from "@keyline-icons/react";
import { motion } from "motion/react";
import { type ReactNode, useState } from "react";
import { cn } from "@/lib/utils";
import { ReferenceTable } from "./reference-table";

export type PropRow = {
  name: string;
  type: string;
  default?: string;
  description: ReactNode;
};

type PropsTableProps = {
  rows: PropRow[];
};

// Hand-authored prop reference. Rows are collapsible — collapsed shows the prop,
// its type (truncated) and default; expanding reveals the description and the
// full type. Columns are fixed-width so they line up across every table on the
// page, AttributesTable included.
export const PropsTable = ({ rows }: PropsTableProps) => (
  <ReferenceTable
    columns={[
      { label: "Prop", width: "w-[30%]" },
      { label: "Type" },
      { label: "Default", width: "w-[22%]" },
      { label: "Details", width: "w-10", srOnly: true },
    ]}
  >
    {rows.map((row) => (
      <PropsRow key={row.name} row={row} />
    ))}
  </ReferenceTable>
);

const PropsRow = ({ row }: { row: PropRow }) => {
  const [open, setOpen] = useState(false);

  return (
    <>
      <tr
        className={cn(
          "cursor-pointer transition-colors",
          open ? "bg-table-tray" : "hover:bg-ink-primary/[0.02]",
        )}
        onClick={() => setOpen((current) => !current)}
      >
        <td className="truncate px-4 py-3.5 align-middle">
          <code className="font-medium font-mono text-ink-primary text-sm">{row.name}</code>
        </td>
        <td className="truncate px-4 py-3.5 align-middle">
          <TypeChip>{row.type}</TypeChip>
        </td>
        <td className="truncate px-4 py-3.5 align-middle">
          {row.default ? (
            <code className="font-mono text-ink-secondary text-xs">{row.default}</code>
          ) : (
            <span className="text-ink-tertiary text-xs">—</span>
          )}
        </td>
        <td className="py-3.5 pr-3 align-middle">
          <button
            type="button"
            aria-label={open ? "Collapse" : "Expand"}
            aria-expanded={open}
            className="grid size-6 cursor-pointer place-items-center rounded-full focus-visible:outline-2 focus-visible:outline-accent-bg/60"
            onClick={(event) => {
              event.stopPropagation();
              setOpen((current) => !current);
            }}
          >
            <ChevronDown
              className={cn(
                "size-3.5 transition-transform",
                open ? "rotate-180 text-ink-primary" : "text-ink-tertiary",
              )}
            />
          </button>
        </td>
      </tr>
      <tr
        aria-hidden={!open}
        // The rule between rows sits on this row, so the last one can drop it.
        className={cn("border-ink-primary/6 border-b last:border-0", open && "bg-table-tray")}
      >
        <td colSpan={4} className="p-0">
          <motion.div
            initial={false}
            animate={{ height: open ? "auto" : 0 }}
            transition={{ duration: 0.22, ease: [0.32, 0.72, 0, 1] }}
            className="overflow-hidden"
          >
            <div className="flex max-w-[560px] flex-col gap-2.5 px-4 pb-4">
              <div className="text-ink-body text-sm leading-5">{row.description}</div>
              <TypeChip className="w-fit max-w-full overflow-x-auto whitespace-pre-wrap">
                {row.type}
              </TypeChip>
            </div>
          </motion.div>
        </td>
      </tr>
    </>
  );
};

const TypeChip = ({ className, children }: { className?: string; children: ReactNode }) => (
  <code
    className={cn(
      "rounded-[4px] bg-ink-primary/6 px-1.5 py-0.5 font-mono text-ink-body text-xs",
      className,
    )}
  >
    {children}
  </code>
);
