"use client";

import { motion } from "motion/react";
import { type ReactNode, useState } from "react";
import { ChevronDownIcon } from "@/components/icons/chevron-down";
import { cn } from "@/lib/utils";

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
// type, and default (type truncated); expanding reveals the description and the
// full untruncated type. Columns are fixed-width so they stay consistent across
// every table on the page.
export const PropsTable = ({ rows }: PropsTableProps) => (
  <div className="not-prose my-6 overflow-hidden rounded-lg border border-secondary-border">
    <table className="w-full table-fixed border-collapse text-left text-sm">
      <colgroup>
        <col className="w-[28%]" />
        <col className="w-[44%]" />
        <col className="w-[28%]" />
      </colgroup>
      <thead>
        <tr className="border-secondary-border border-b bg-tertiary-bg">
          <th className="px-4 py-2.5 font-medium text-ink-primary">Prop</th>
          <th className="px-4 py-2.5 font-medium text-ink-primary">Type</th>
          <th className="px-4 py-2.5 font-medium text-ink-primary">Default</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <PropsRow key={row.name} row={row} />
        ))}
      </tbody>
    </table>
  </div>
);

const PropsRow = ({ row }: { row: PropRow }) => {
  const [open, setOpen] = useState(false);

  return (
    <>
      <tr
        className="cursor-pointer border-secondary-border/60 border-b last:border-0 hover:bg-primary-bg-hover/50"
        onClick={() => setOpen((current) => !current)}
      >
        <td className="px-4 py-2.5 align-top">
          <code className="font-mono text-ink-primary text-xs">{row.name}</code>
        </td>
        <td className="truncate px-4 py-2.5 align-top">
          <code className="font-mono text-accent-bg text-xs">{row.type}</code>
        </td>
        <td className="px-4 py-2.5 align-top">
          <div className="flex items-center justify-between gap-2">
            {row.default ? (
              <code className="truncate font-mono text-ink-tertiary text-xs">{row.default}</code>
            ) : (
              <span className="text-ink-tertiary">—</span>
            )}
            <button
              type="button"
              aria-label={open ? "Collapse" : "Expand"}
              aria-expanded={open}
              className="shrink-0 text-ink-tertiary"
              onClick={(event) => {
                event.stopPropagation();
                setOpen((current) => !current);
              }}
            >
              <ChevronDownIcon
                className={cn("size-4 transition-transform", open ? "rotate-180" : "rotate-0")}
              />
            </button>
          </div>
        </td>
      </tr>
      <tr
        aria-hidden={!open}
        className={cn(open && "border-secondary-border/60 border-b bg-base-bg/40")}
      >
        <td colSpan={3} className="p-0">
          <motion.div
            initial={false}
            animate={{ height: open ? "auto" : 0 }}
            transition={{
              duration: 0.22,
              ease: [0.32, 0.72, 0, 1],
            }}
            className="overflow-hidden"
          >
            <motion.dl
              initial={false}
              animate={{ opacity: open ? 1 : 0 }}
              transition={{
                duration: 0.15,
                ease: "easeOut",
              }}
              className="flex flex-col gap-3 py-4"
            >
              <DetailRow label="Name">
                <code className="font-mono text-ink-primary text-xs">{row.name}</code>
              </DetailRow>
              <DetailRow label="Description">
                <span className="text-ink-secondary">{row.description}</span>
              </DetailRow>
              <DetailRow label="Type">
                <code className="block w-fit max-w-full overflow-x-auto rounded border border-base-border bg-base-bg px-1 py-px font-mono text-accent-bg text-xs">
                  {row.type}
                </code>
              </DetailRow>
              <DetailRow label="Default">
                {row.default ? (
                  <code className="font-mono text-ink-secondary text-xs">{row.default}</code>
                ) : (
                  <span className="text-ink-tertiary">—</span>
                )}
              </DetailRow>
            </motion.dl>
          </motion.div>
        </td>
      </tr>
    </>
  );
};

// Mirror the collapsed row's column grid (first col 28%, matching the <colgroup>): the
// label sits under the "Prop" column and its value under "Type", each with the cells'
// px-4 so the detail lines up with the row above it.
const DetailRow = ({ label, children }: { label: string; children: ReactNode }) => (
  <div className="grid grid-cols-[28%_1fr] items-baseline">
    <dt className="px-4 text-ink-tertiary text-xs">{label}</dt>
    <dd className="min-w-0 px-4 text-sm">{children}</dd>
  </div>
);
