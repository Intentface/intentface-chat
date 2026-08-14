// Add explicit .js extensions to relative specifiers in the emitted output.
//
// Why this exists rather than writing extensions in src: the app consumes the
// package's *source* through Next's transpilePackages, and Turbopack does not
// resolve "./actions.js" against actions.tsx — it has no extensionAlias
// equivalent. Extensions in src would therefore break the dev loop. tsc has no
// option to add them on emit either (rewriteRelativeImportExtensions only
// rewrites specifiers that already carry one), so the published artifact gets
// them here instead.
//
// Source stays bundler-friendly; dist stays valid ESM.

import { readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const distDir = fileURLToPath(new URL("../dist", import.meta.url));

const walk = (dir) =>
  readdirSync(dir, { withFileTypes: true }).flatMap((entry) =>
    entry.isDirectory() ? walk(join(dir, entry.name)) : [join(dir, entry.name)],
  );

const isFile = (path) => {
  try {
    return statSync(path).isFile();
  } catch {
    return false;
  }
};

// A specifier resolves either to a sibling module or to a directory's index.
const withExtension = (fromFile, specifier) => {
  const target = resolve(dirname(fromFile), specifier);
  if (isFile(`${target}.js`)) return `${specifier}.js`;
  if (isFile(join(target, "index.js"))) return `${specifier}/index.js`;
  return null;
};

// `from "x"`, bare `import "x"`, and dynamic `import("x")` — in either quote
// style. Matching only double quotes silently skipped the vendored files under
// src/internal/render, which came from Base UI's source and use single quotes:
// their specifiers shipped extensionless, which bundlers resolve but Node's ESM
// resolver rejects, so the package failed to load under SSR.
const SPECIFIER = /(\bfrom\s*|\bimport\s*|\bimport\s*\(\s*)(["'])(\.\.?\/[^"']*)\2/g;

let rewritten = 0;
const unresolved = [];

for (const file of walk(distDir)) {
  if (!/\.(js|d\.ts)$/.test(file)) continue;
  const original = readFileSync(file, "utf8");
  const updated = original.replace(SPECIFIER, (match, prefix, quote, specifier) => {
    if (/\.(js|json|css)$/.test(specifier)) return match;
    const next = withExtension(file, specifier);
    if (!next) {
      unresolved.push(`${file}: ${specifier}`);
      return match;
    }
    rewritten++;
    return prefix + quote + next + quote;
  });
  if (updated !== original) writeFileSync(file, updated);
}

if (unresolved.length > 0) {
  throw new Error(`Unresolved relative specifiers in dist:\n  ${unresolved.join("\n  ")}`);
}

console.log(`add-dist-extensions: rewrote ${rewritten} specifiers`);
