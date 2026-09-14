"use client";

import { IconChevronDown } from "@tabler/icons-react";
import { motion } from "motion/react";
import { type ReactNode, useState } from "react";
import { cn } from "@/lib/utils";

export type AttributeRow = {
  attribute: string;
  values?: string;
  description: ReactNode;
};

type AttributesTableProps = {
  rows: AttributeRow[];
};

// Hand-authored data-attribute reference — the styling hooks a part emits.
// Built exactly like PropsTable: collapsed shows the attribute and its values,
// expanding reveals the description. The two sit next to each other in every
// API reference, so they read as one control rather than two.
export const AttributesTable = ({ rows }: AttributesTableProps) => {
  const hasValues = rows.some((row) => row.values);

  return (
    <div className="not-prose my-6 overflow-hidden rounded-lg border border-secondary-border bg-primary-bg">
      <table className="w-full table-fixed border-collapse text-left text-sm">
        <colgroup>
          <col className="w-[28%]" />
          <col className="w-[44%]" />
          <col className="w-[28%]" />
        </colgroup>
        <thead>
          <tr className="border-secondary-border border-b bg-secondary-bg">
            <th className="px-4 py-2.5 font-medium text-ink-primary">Attribute</th>
            <th className="px-4 py-2.5 font-medium text-ink-primary">Values</th>
            <th className="px-4 py-2.5 font-medium text-ink-primary">
              <span className="sr-only">Details</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <AttributeTableRow key={row.attribute} row={row} hasValues={hasValues} />
          ))}
        </tbody>
      </table>
    </div>
  );
};

const AttributeTableRow = ({ row, hasValues }: { row: AttributeRow; hasValues: boolean }) => {
  const [open, setOpen] = useState(false);

  return (
    <>
      <tr
        className="cursor-pointer border-secondary-border/60 border-b last:border-0 hover:bg-primary-bg-hover/50"
        onClick={() => setOpen((current) => !current)}
      >
        <td className="px-4 py-2.5 align-top">
          <code className="font-mono text-ink-primary text-xs">{row.attribute}</code>
        </td>
        <td className="truncate px-4 py-2.5 align-top">
          {row.values ? (
            <code className="font-mono text-accent-bg text-xs">{row.values}</code>
          ) : (
            <span className="text-ink-tertiary">{hasValues ? "—" : ""}</span>
          )}
        </td>
        <td className="px-4 py-2.5 align-top">
          <div className="flex justify-end">
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
              <IconChevronDown
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
            transition={{ duration: 0.22, ease: [0.32, 0.72, 0, 1] }}
            className="overflow-hidden"
          >
            <dl className="flex flex-col gap-3 py-4">
              <DetailRow label="Attribute">
                <code className="font-mono text-ink-primary text-xs">{row.attribute}</code>
              </DetailRow>
              <DetailRow label="Description">
                <span className="text-ink-secondary">{row.description}</span>
              </DetailRow>
              <DetailRow label="Values">
                {row.values ? (
                  <code className="font-mono text-accent-bg text-xs">{row.values}</code>
                ) : (
                  <span className="text-ink-tertiary">—</span>
                )}
              </DetailRow>
            </dl>
          </motion.div>
        </td>
      </tr>
    </>
  );
};

// Mirrors PropsTable's detail grid, so an expanded attribute and an expanded
// prop line up with each other down the page.
const DetailRow = ({ label, children }: { label: string; children: ReactNode }) => (
  <div className="grid grid-cols-[28%_1fr] items-baseline">
    <dt className="px-4 text-ink-tertiary text-xs">{label}</dt>
    <dd className="px-4 text-sm">{children}</dd>
  </div>
);
