"use client";

import type { ReactNode } from "react";
import { useState } from "react";
import { CheckMarkMediumIcon } from "@/components/icons/check-mark-medium";
import { CopyIcon } from "@/components/icons/copy";
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
    <div className="not-prose my-6 overflow-hidden rounded-lg border border-primary-border">
      <div className="flex items-center gap-1 border-primary-border border-b bg-primary-bg p-1.5">
        {entries.map((entry) => (
          <button
            key={entry.manager}
            type="button"
            onClick={() => setManager(entry.manager)}
            className={cn(
              "cursor-pointer rounded-full border px-3 py-1 font-mono text-sm transition-colors",
              entry.manager === manager
                ? "border-secondary-border bg-secondary-bg text-ink-primary shadow-xs"
                : "border-transparent text-ink-tertiary hover:bg-primary-bg-hover hover:text-ink-secondary",
            )}
          >
            {entry.manager}
          </button>
        ))}
        <button
          type="button"
          onClick={() => copy(current.command)}
          aria-label={`Copy: ${current.command}`}
          className="ml-auto cursor-pointer rounded-md p-1.5 text-ink-tertiary transition-colors hover:bg-primary-bg-hover hover:text-ink-secondary"
        >
          {copied === current.command ? <CheckMarkMediumIcon /> : <CopyIcon />}
        </button>
      </div>
      <div className="[&_pre]:rounded-none [&_pre]:border-0">{current.code}</div>
    </div>
  );
};
