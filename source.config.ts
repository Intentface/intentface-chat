import { defineConfig, defineDocs } from "fumadocs-mdx/config";

export const docs = defineDocs({
  dir: "content/docs",
});

export default defineConfig({
  mdxOptions: {
    // Disable fumadocs' built-in shiki pass so fenced code reaches our `pre`
    // handler as raw text. Highlighting is done in one place — the CodeBlock
    // component (fumadocs-core `highlight`) — shared by MDX fences, the styled
    // source viewer, and component previews.
    rehypeCodeOptions: false,
  },
});
