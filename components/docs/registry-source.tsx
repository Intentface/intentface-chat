import { readFile } from "node:fs/promises";
import path from "node:path";
import { CodeBlock } from "./code-block";

type RegistryFile = {
  path: string;
  target?: string;
  content: string;
};

type RegistryItem = {
  name: string;
  files?: RegistryFile[];
};

type RegistrySourceProps = {
  item: string;
};

const langForPath = (filePath: string): string => {
  if (filePath.endsWith(".css")) return "css";
  if (filePath.endsWith(".json")) return "json";
  if (filePath.endsWith(".ts")) return "ts";
  return "tsx";
};

// Server component: renders the built registry item's files exactly as
// `shadcn add` would write them. Reads public/r/<item>.json (produced by
// `bun run intentface:build-registry`, which the root build chains).
export const RegistrySource = async ({ item }: RegistrySourceProps) => {
  let data: RegistryItem;
  try {
    const raw = await readFile(path.join(process.cwd(), "public", "r", `${item}.json`), "utf8");
    data = JSON.parse(raw) as RegistryItem;
  } catch {
    return (
      <div className="my-6 rounded-lg border border-destructive/40 bg-destructive/10 p-4 text-destructive text-sm">
        Registry item <code>{item}</code> not found. Run{" "}
        <code>bun run intentface:build-registry</code>.
      </div>
    );
  }

  const files = data.files ?? [];
  if (files.length === 0) {
    return (
      <p className="my-6 text-ink-tertiary text-sm">
        This item bundles other items and ships no files of its own.
      </p>
    );
  }

  return (
    <div className="my-6 flex flex-col gap-4">
      {files.map((file) => (
        <CodeBlock
          key={file.target ?? file.path}
          code={file.content.trimEnd()}
          lang={langForPath(file.target ?? file.path)}
          title={file.target?.replace(/^~\//, "") ?? file.path}
        />
      ))}
    </div>
  );
};
