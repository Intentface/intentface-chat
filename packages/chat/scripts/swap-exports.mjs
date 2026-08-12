// Dev vs. publish exports switch.
//
// In the repo, `exports` points at ./src/* so the app consumes the package
// source directly (via Next `transpilePackages`) with no build step. The
// published package must instead expose ./dist/*. npm/`npm pack` does NOT apply
// `publishConfig.exports` overrides to the packed package.json, so we swap the
// field in place at pack time and restore it afterward.
//
//   prepack:     node scripts/swap-exports.mjs pre        (after the build)
//   postpack:    node scripts/swap-exports.mjs post-pack
//   postpublish: node scripts/swap-exports.mjs post
//
// Why the restore is split across two hooks: npm packs the tarball from disk,
// but it builds the *registry metadata* (the packument — what `npm view` reads)
// from package.json as it stands after postpack. Restoring there published a
// tarball with ./dist exports alongside a packument still advertising ./src.
// Harmless to consumers, since resolution uses the installed package.json from
// the tarball, but it makes `npm view <pkg> exports` actively misleading. So
// during a publish the restore defers to postpublish, once the metadata is
// sent; a plain `npm pack` still restores immediately.
//
// The committed state always carries the ./src exports, so an interrupted pack
// leaves the working tree in the correct dev configuration.

import { copyFileSync, existsSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const pkgPath = fileURLToPath(new URL("../package.json", import.meta.url));
const backupPath = fileURLToPath(new URL("../package.json.prepack-bak", import.meta.url));
const mode = process.argv[2];

const restore = () => {
  if (!existsSync(backupPath)) return;
  copyFileSync(backupPath, pkgPath);
  rmSync(backupPath);
};

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
} else if (mode === "post-pack") {
  // npm sets npm_command to the invoking command. Under `publish` the swapped
  // package.json must survive until the packument is built — postpublish undoes
  // it. Under `pack` (or anything else) nothing reads it afterward, so restore
  // right away and leave no window where the tree is dirty.
  if (process.env.npm_command !== "publish") restore();
} else if (mode === "post") {
  restore();
} else {
  throw new Error(`Unknown mode "${mode}" — expected "pre", "post-pack" or "post".`);
}
