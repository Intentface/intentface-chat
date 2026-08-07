import { readFile } from "node:fs/promises";
import path from "node:path";
import type { ReactNode } from "react";
import { CodeBlock } from "./code-block";
import { ComponentPreviewFrame } from "./component-preview-frame";

type DemoProps = {
  component: ReactNode;
  /** Path under content/docs, e.g. "primitives/composer/demos/basic.tsx". */
  file: string;
};

// Server component: renders a colocated demo and shows that same file's source,
// read from disk at build time — the file that runs is the file displayed.
export const Demo = async ({ component, file }: DemoProps) => {
  const source = await readFile(path.join(process.cwd(), "content", "docs", file), "utf8");

  return (
    <ComponentPreviewFrame
      preview={component}
      code={<CodeBlock code={source.trimEnd()} lang="tsx" />}
    />
  );
};
