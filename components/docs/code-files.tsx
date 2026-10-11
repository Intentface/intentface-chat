"use client";

import { Tabs } from "@base-ui/react/tabs";
import type { ReactNode } from "react";
import { useState } from "react";
import { CodeFrame, CodePanel, CodeTab, CodeTabList } from "./code-frame";

export type CodeFileEntry = {
  name: string;
  source: string;
  /** Pre-highlighted source, rendered on the server. */
  code: ReactNode;
};

// Client shell for a multi-file block: one tab per file. The server highlights
// every file up front; this only picks which one shows and gets copied.
export const CodeFiles = ({ files, className }: { files: CodeFileEntry[]; className?: string }) => {
  const [name, setName] = useState(files[0].name);
  const current = files.find((file) => file.name === name) ?? files[0];

  return (
    <Tabs.Root value={name} onValueChange={setName}>
      <CodeFrame
        className={className}
        code={current.source}
        tabs={
          <CodeTabList>
            {files.map((file) => (
              <CodeTab key={file.name} value={file.name}>
                {file.name}
              </CodeTab>
            ))}
          </CodeTabList>
        }
      >
        {files.map((file) => (
          <CodePanel key={file.name} value={file.name}>
            {file.code}
          </CodePanel>
        ))}
      </CodeFrame>
    </Tabs.Root>
  );
};
