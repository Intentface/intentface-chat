import { readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";
import { tool } from "ai";
import { z } from "zod";

const SOURCE_ROOT = path.join(process.cwd(), "packages", "chat", "src");

export const readSourceFile = tool({
  description:
    'Read @intentface/chat source code from packages/chat/src. A file path returns its contents; a directory path returns its entries; "." lists the top level. Docs pages name their component via the source field from listDocsPages.',
  inputSchema: z.object({
    path: z
      .string()
      .describe('Path relative to packages/chat/src, e.g. "thread/index.tsx" or "composer"'),
  }),
  execute: async ({ path: requestedPath }) => {
    const resolvedPath = path.resolve(SOURCE_ROOT, requestedPath);
    if (resolvedPath !== SOURCE_ROOT && !resolvedPath.startsWith(SOURCE_ROOT + path.sep)) {
      return { error: `"${requestedPath}" is outside packages/chat/src.` };
    }

    const stats = await stat(resolvedPath).catch(() => null);
    if (!stats) {
      return {
        error: `No file or directory "${requestedPath}" in packages/chat/src. Use "." to list the top level.`,
      };
    }

    if (stats.isDirectory()) {
      const entries = await readdir(resolvedPath, { withFileTypes: true });
      return {
        path: requestedPath,
        entries: entries.map((entry) => (entry.isDirectory() ? `${entry.name}/` : entry.name)),
      };
    }

    const code = await readFile(resolvedPath, "utf8");
    return { path: requestedPath, code };
  },
});
