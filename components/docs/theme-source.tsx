import { readFile } from "node:fs/promises";
import path from "node:path";
import { CodeBlock } from "./code-block";

// Server component: renders the Intentface theme token CSS from disk so the
// theming page shows the exact block to copy, with no duplication.
export const ThemeSource = async () => {
  const css = await readFile(
    path.join(process.cwd(), "packages", "intentface", "registry", "intentface.css"),
    "utf8",
  );

  return (
    <div className="my-6">
      <CodeBlock code={css.trimEnd()} lang="css" title="app/globals.css" />
    </div>
  );
};
