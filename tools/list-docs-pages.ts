import { tool } from "ai";
import { z } from "zod";
import { getPages } from "@/lib/docs/source";

export const listDocsPages = tool({
  description:
    "List the @intentface/ui documentation pages. Call this first when the user asks about the library — its primitives, installation, styling, or internals — to discover which pages to read. Each page's source field names its component under packages/ui/src for readSourceFile.",
  inputSchema: z.object({}),
  execute: async (_input, { toolCallId }) => {
    const pages = getPages().map((page) => ({
      slug: page.slugs.length ? page.slugs.join("/") : "index",
      title: page.data.title,
      description: page.data.description,
      url: page.url,
      source: page.data.source,
    }));
    return {
      pages,
      summary: `Found ${pages.length} documentation pages`,
      // What renderUi binds a table's rows to, instead of copying the pages.
      ref: toolCallId,
    };
  },
});
