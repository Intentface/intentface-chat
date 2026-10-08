"use client";

import type { ReactNode } from "react";
import { useState } from "react";
import { CodeFrame, CodeTab } from "./code-frame";

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
    <CodeFrame
      className={className}
      code={current.source}
      tabs={files.map((file) => (
        <CodeTab key={file.name} active={file.name === name} onClick={() => setName(file.name)}>
          {file.name}
        </CodeTab>
      ))}
    >
      {current.code}
    </CodeFrame>
  );
};
