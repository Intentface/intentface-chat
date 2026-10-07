"use client";

import type { ReactNode } from "react";
import { useState } from "react";
import { CodeFrame, CodeTab } from "./code-frame";

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
// command up front; this only picks which one shows.
export const InstallationBlockTabs = ({ entries }: InstallationBlockTabsProps) => {
  const [manager, setManager] = useState(entries[0].manager);
  const current = entries.find((entry) => entry.manager === manager) ?? entries[0];

  return (
    <CodeFrame
      className="my-6"
      code={current.command}
      tabs={entries.map((entry) => (
        <CodeTab
          key={entry.manager}
          active={entry.manager === manager}
          onClick={() => setManager(entry.manager)}
        >
          {entry.manager}
        </CodeTab>
      ))}
    >
      {current.code}
    </CodeFrame>
  );
};
