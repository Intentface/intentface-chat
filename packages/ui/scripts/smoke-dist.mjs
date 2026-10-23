// Every published entry must load under Node's ESM resolver.
//
// This exists because 0.1.1 shipped unloadable: the extension rewrite missed
// single-quoted specifiers, no regex-side check could see its own blind spot,
// and publint doesn't resolve the internal module graph. The failure was a
// resolution error, so this tests resolution itself — importing each subpath in
// the exports map (the entire consumer-reachable surface) — rather than a
// regex's opinion of it. Must run under `node`, not `bun`: Bun's resolver
// accepts extensionless specifiers and would mask exactly this class of bug.

import { readFileSync } from "node:fs";

const pkg = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));
const entries = Object.entries(pkg.exports);

for (const [subpath, entry] of entries) {
  await import(new URL(`../${entry.default}`, import.meta.url).href).catch((error) => {
    throw new Error(`${subpath} (${entry.default}) does not load in Node: ${error.message}`);
  });
}

console.log(`smoke-dist: all ${entries.length} entries load`);
