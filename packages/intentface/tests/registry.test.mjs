import assert from "node:assert/strict";
import { glob, readFile, stat } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

test("every manifest sourcePath exists on disk", async () => {
  const manifestPath = fileURLToPath(new URL("../registry/manifest.json", import.meta.url));
  const repoRoot = path.resolve(path.dirname(manifestPath), "..", "..", "..");
  const manifest = JSON.parse(await readFile(manifestPath, "utf8"));

  for (const item of manifest.items) {
    for (const file of item.files ?? []) {
      if (file.sourcePath.includes("*")) {
        const matches = await Array.fromAsync(glob(file.sourcePath, { cwd: repoRoot }));
        assert.ok(matches.length > 0, `${item.name}: glob "${file.sourcePath}" matched no files`);
        continue;
      }
      await assert.doesNotReject(
        stat(path.join(repoRoot, file.sourcePath)),
        `${item.name}: sourcePath "${file.sourcePath}" does not exist`,
      );
    }
  }
});
