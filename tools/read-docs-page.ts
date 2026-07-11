import { readFile } from "node:fs/promises";
import path from "node:path";
import { tool } from "ai";
import { z } from "zod";
import { getPage } from "@/lib/docs/source";

export const readDocsPage = tool({
  description:
    "Read one @intentface/chat documentation page as raw markdown. Use a slug returned by listDocsPages.",
  inputSchema: z.object({
    slug: z.string().describe('Page slug from listDocsPages, e.g. "primitives/composer"'),
  }),
  execute: async ({ slug }) => {
    const page = getPage(slug === "index" ? [] : slug.split("/"));
    if (!page) {
      return { error: `No documentation page "${slug}". Call listDocsPages for valid slugs.` };
    }

    const filePath = page.absolutePath ?? path.join(process.cwd(), "content", "docs", page.path);
    const markdown = await readFile(filePath, "utf8");

    return {
      slug,
      title: page.data.title,
      url: page.url,
      markdown,
    };
  },
});
