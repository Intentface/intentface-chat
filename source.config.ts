import { defineConfig, defineDocs, frontmatterSchema } from "fumadocs-mdx/config";
import { z } from "zod";
import { remarkChangelogTags } from "./lib/docs/remark-changelog-tags";

export const docs = defineDocs({
  dir: "content/docs",
  docs: {
    // `source` is the component's path under packages/ui/src (a directory
    // like "composer" or a file like "thread.tsx"); the page header links
    // "View source" to it on GitHub.
    schema: frontmatterSchema.extend({
      source: z.string().optional(),
    }),
  },
});

export default defineConfig({
  mdxOptions: {
    remarkPlugins: [remarkChangelogTags],
    // Disable fumadocs' built-in shiki pass so fenced code reaches our `pre`
    // handler as raw text. Highlighting is done in one place — the CodeBlock
    // component (fumadocs-core `highlight`) — shared by MDX fences, the styled
    // source viewer, and component previews.
    rehypeCodeOptions: false,
  },
});
