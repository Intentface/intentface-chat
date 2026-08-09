import { readFile } from "node:fs/promises";
import path from "node:path";
import { PACKAGE_MANAGERS } from "./package-managers";

const DOCS_DIR = path.join(process.cwd(), "content", "docs");

// <InstallationBlock packageName="@intentface/chat" />
const INSTALL_TAG = /<InstallationBlock\b[\s\S]*?\spackageName="([^"]+)"[\s\S]*?\/>/g;

// <Demo component={<Basic />} file="primitives/composer/demos/basic.tsx" />
// `[\s\S]` rather than `[^>]`: the component prop holds JSX, so the tag has a
// nested `/>` before its own.
const DEMO_TAG = /<Demo\b[\s\S]*?\sfile="([^"]+)"[\s\S]*?\/>/g;

// The MDX imports that only exist to feed those tags.
const DEMO_IMPORT = /^import\s+\{[^}]*\}\s+from\s+["']\.\/[^"']*\/demos\/[^"']*["'];?[ \t]*\r?\n/gm;

/**
 * Rewrites a docs page's raw MDX for non-browser readers: every `<Demo>` becomes
 * a fenced code block holding the demo's actual source, and the imports that fed
 * those tags are dropped. Without this an agent reads an opaque tag and no code.
 */
export const expandDemos = async (markdown: string): Promise<string> => {
  const expanded = markdown.replace(INSTALL_TAG, (_tag, packageName: string) => {
    const [first, ...rest] = PACKAGE_MANAGERS;
    const alternatives = rest.map(({ install }) => `# ${install} ${packageName}`);
    return ["```bash", `${first.install} ${packageName}`, ...alternatives, "```"].join("\n");
  });

  const files = [...expanded.matchAll(DEMO_TAG)].map(([, file]) => file);
  if (files.length === 0) return expanded;

  const sources = new Map<string, string>();
  await Promise.all(
    [...new Set(files)].map(async (file) => {
      // Defence in depth: `file` comes from our own MDX, but never let a path
      // escape content/docs.
      const resolved = path.resolve(DOCS_DIR, file);
      if (!resolved.startsWith(`${DOCS_DIR}${path.sep}`)) return;
      try {
        sources.set(file, await readFile(resolved, "utf8"));
      } catch {
        // Leave the tag untouched rather than emit a half-broken page.
      }
    }),
  );

  return expanded
    .replace(DEMO_IMPORT, "")
    .replace(DEMO_TAG, (tag, file: string) => {
      const source = sources.get(file);
      return source ? `\`\`\`tsx title="${file}"\n${source.trimEnd()}\n\`\`\`` : tag;
    })
    .replace(/\n{3,}/g, "\n\n");
};
