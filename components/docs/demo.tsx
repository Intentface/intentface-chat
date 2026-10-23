import type { ReactNode } from "react";
import { languageOf, readDemoFiles } from "@/lib/docs/demo-files";
import { highlightCode } from "./code-block";
import { CodeFiles } from "./code-files";
import { ComponentPreviewFrame } from "./component-preview-frame";

type DemoProps = {
  component: ReactNode;
  /** Path under content/docs, e.g. "primitives/composer/demos/basic.tsx". */
  file: string;
  /** Show the corner Replay. Off for a demo with its own replay control, or nothing to replay. */
  replay?: boolean;
};

// Server component: renders a colocated demo and shows its source, read from
// disk at build time — the files that run are the files displayed. A demo split
// across local imports shows one tab per file.
export const Demo = async ({ component, file, replay }: DemoProps) => {
  const files = await readDemoFiles(file);
  const entries = await Promise.all(
    files.map(async ({ name, file: filePath, source }) => ({
      name,
      source: source.trimEnd(),
      code: await highlightCode(source.trimEnd(), languageOf(filePath)),
    })),
  );

  return (
    <ComponentPreviewFrame
      preview={component}
      code={<CodeFiles files={entries} />}
      replay={replay}
    />
  );
};
