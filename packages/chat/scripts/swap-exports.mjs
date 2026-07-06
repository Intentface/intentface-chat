// Dev vs. publish exports switch.
//
// In the repo, `exports` points at ./src/* so the app consumes the package
// source directly (via Next `transpilePackages`) with no build step. The
// published package must instead expose ./dist/*. npm/`npm pack` does NOT apply
// `publishConfig.exports` overrides to the packed package.json, so we swap the
// field in place at pack time and restore it afterward.
//
//   prepack:  node scripts/swap-exports.mjs pre   (after the build)
//   postpack: node scripts/swap-exports.mjs post
//
// The committed state always carries the ./src exports, so an interrupted pack
// leaves the working tree in the correct dev configuration.

import { copyFileSync, existsSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const pkgPath = fileURLToPath(new URL("../package.json", import.meta.url));
const backupPath = fileURLToPath(new URL("../package.json.prepack-bak", import.meta.url));
const mode = process.argv[2];

if (mode === "pre") {
  copyFileSync(pkgPath, backupPath);
  const pkg = JSON.parse(readFileSync(pkgPath, "utf8"));
  const distExports = pkg.publishConfig?.exports;
  if (!distExports) {
    throw new Error("publishConfig.exports missing — nothing to swap to for publish.");
  }
  pkg.exports = distExports;
  delete pkg.publishConfig.exports;
  writeFileSync(pkgPath, `${JSON.stringify(pkg, null, 2)}\n`);
} else if (mode === "post") {
  if (existsSync(backupPath)) {
    copyFileSync(backupPath, pkgPath);
    rmSync(backupPath);
  }
} else {
  throw new Error(`Unknown mode "${mode}" — expected "pre" or "post".`);
}
