import { tool } from "ai";
import { z } from "zod";
import { getPages } from "@/lib/docs/source";

export const listDocsPages = tool({
  description:
    "List the @intentface/chat documentation pages. Call this first when the user asks about the library — its primitives, installation, theming, or internals — to discover which pages to read.",
  inputSchema: z.object({}),
  execute: async () => {
    const pages = getPages().map((page) => ({
      slug: page.slugs.length ? page.slugs.join("/") : "index",
      title: page.data.title,
      description: page.data.description,
      url: page.url,
    }));
    return {
      pages,
      summary: `Found ${pages.length} documentation pages`,
    };
  },
});
