import { readFile } from "node:fs/promises";
import path from "node:path";
import { CodeBlock } from "./code-block";
import { ComponentPreviewFrame } from "./component-preview-frame";
import { previews } from "./previews";

type ComponentPreviewProps = {
  name: keyof typeof previews | (string & {});
};

// Server component: renders a demo from the explicit preview registry and shows
// the demo file's own source (read from disk at build time) in the code tab —
// the file that runs is the file that's displayed, so they can't drift.
export const ComponentPreview = async ({ name }: ComponentPreviewProps) => {
  const entry = previews[name];
  if (!entry) {
    return (
      <div className="my-6 rounded-lg border border-destructive/40 bg-destructive/10 p-4 text-destructive text-sm">
        Unknown preview: <code>{name}</code>
      </div>
    );
  }

  const source = await readFile(path.join(process.cwd(), entry.file), "utf8");
  const { Component } = entry;

  return (
    <ComponentPreviewFrame
      preview={<Component />}
      code={<CodeBlock code={source.trimEnd()} lang="tsx" />}
    />
  );
};
