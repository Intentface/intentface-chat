import { readFile } from "node:fs/promises";
import path from "node:path";

const DOCS_DIR = path.join(process.cwd(), "content", "docs");

// `from "./x"`, `from "../x"` and side-effect `import "./x.css"`.
const LOCAL_IMPORT = /(?:\bfrom\s+|\bimport\s+)["'](\.{1,2}\/[^"']+)["']/g;
const EXTENSIONS = ["", ".tsx", ".ts", ".css", "/index.tsx", "/index.ts"];

export type DemoFile = {
  /** Path under content/docs. */
  file: string;
  /** The tab label: the path relative to the entry's directory. */
  name: string;
  source: string;
};

const readInDocs = async (file: string) => {
  // Defence in depth: paths come from our own MDX and demos, but never let one
  // escape content/docs.
  const resolved = path.resolve(DOCS_DIR, file);
  if (!resolved.startsWith(`${DOCS_DIR}${path.sep}`)) return null;
  try {
    return await readFile(resolved, "utf8");
  } catch {
    return null;
  }
};

const resolveImport = async (from: string, specifier: string) => {
  const base = path.join(path.dirname(from), specifier);
  for (const extension of EXTENSIONS) {
    const source = await readInDocs(base + extension);
    if (source !== null) return { file: base + extension, source };
  }
  return null;
};

/**
 * A demo's entry file followed by every local file it imports, depth-first and
 * deduped — the files that run are the files displayed, one tab each.
 */
export const readDemoFiles = async (entry: string): Promise<DemoFile[]> => {
  const entrySource = await readInDocs(entry);
  if (entrySource === null) return [];

  const root = path.dirname(entry);
  const files: DemoFile[] = [];
  const seen = new Set<string>();

  const visit = async (file: string, source: string) => {
    seen.add(file);
    files.push({ file, name: path.relative(root, file), source });
    for (const [, specifier] of source.matchAll(LOCAL_IMPORT)) {
      const imported = await resolveImport(file, specifier);
      if (imported && !seen.has(imported.file)) await visit(imported.file, imported.source);
    }
  };

  await visit(entry, entrySource);
  return files;
};

export const languageOf = (file: string) => path.extname(file).slice(1) || "tsx";
