"use client";

import { IconCheck, IconCopy } from "@tabler/icons-react";
import type { ReactNode } from "react";
import { useState } from "react";
import { useCopy } from "@/hooks/use-copy";
import { cn } from "@/lib/utils";

export type InstallationEntry = {
  manager: string;
  command: string;
  /** Pre-highlighted command, rendered on the server. */
  code: ReactNode;
};

type InstallationBlockTabsProps = {
  entries: InstallationEntry[];
};

// Client shell for the package-manager tabs. The server highlights every
// command up front; this only picks which one shows and owns the copy button.
export const InstallationBlockTabs = ({ entries }: InstallationBlockTabsProps) => {
  const [manager, setManager] = useState(entries[0].manager);
  const { copy, copied } = useCopy();
  const current = entries.find((entry) => entry.manager === manager) ?? entries[0];

  return (
    <div className="not-prose my-6 overflow-hidden rounded-xl border border-secondary-border">
      <div className="flex items-center gap-1 border-secondary-border border-b bg-secondary-bg p-2">
        {entries.map((entry) => (
          <button
            key={entry.manager}
            type="button"
            onClick={() => setManager(entry.manager)}
            className={cn(
              "cursor-pointer rounded-full border px-3 py-1.5 font-medium text-sm transition-colors",
              entry.manager === manager
                ? "border-primary-border bg-primary-bg text-ink-primary shadow-xs"
                : "border-transparent text-ink-tertiary hover:bg-primary-bg hover:text-ink-secondary",
            )}
          >
            {entry.manager}
          </button>
        ))}
        <button
          type="button"
          onClick={() => copy(current.command)}
          aria-label={`Copy: ${current.command}`}
          className="ml-auto grid size-8 cursor-pointer place-items-center rounded-full text-ink-tertiary transition-colors hover:bg-primary-bg hover:text-ink-secondary"
        >
          {copied === current.command ? (
            <IconCheck className="size-4" />
          ) : (
            <IconCopy className="size-4" />
          )}
        </button>
      </div>
      <div className="[&_pre]:rounded-none [&_pre]:border-0">{current.code}</div>
    </div>
  );
};
