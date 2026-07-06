"use client";

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
        <tr className="border-secondary-border border-b bg-tertiary">
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
        className="cursor-pointer border-secondary-border/60 border-b last:border-0 hover:bg-primary-hover/50"
        onClick={() => setOpen((current) => !current)}
      >
        <td className="px-4 py-2.5 align-top">
          <code className="font-mono text-ink-primary text-xs">{row.name}</code>
        </td>
        <td className="truncate px-4 py-2.5 align-top">
          <code className="font-mono text-accent text-xs">{row.type}</code>
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
      {open && (
        <tr className="border-secondary-border/60 border-b bg-base/40 last:border-0">
          <td colSpan={3} className="px-4 py-4">
            <dl className="flex animate-in flex-col gap-3 fade-in slide-in-from-top-1">
              <DetailRow label="Name">
                <code className="font-mono text-ink-primary text-xs">{row.name}</code>
              </DetailRow>
              <DetailRow label="Description">
                <span className="text-ink-secondary">{row.description}</span>
              </DetailRow>
              <DetailRow label="Type">
                <code className="block w-fit max-w-full overflow-x-auto rounded-md border border-base-border bg-base px-3 py-1.5 font-mono text-accent text-xs">
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
            </dl>
          </td>
        </tr>
      )}
    </>
  );
};

const DetailRow = ({ label, children }: { label: string; children: ReactNode }) => (
  <div className="grid grid-cols-[7rem_1fr] items-baseline gap-4">
    <dt className="text-ink-tertiary text-xs">{label}</dt>
    <dd className="min-w-0 text-sm">{children}</dd>
  </div>
);
