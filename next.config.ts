import { createMDX } from "fumadocs-mdx/next";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@intentface/chat"],
  // Any docs page is readable as markdown by appending `.md` — the convention
  // agents expect, and guessable from a page URL. It maps onto the same handler
  // that "View as Markdown" uses.
  rewrites: async () => [{ source: "/docs/:slug*.md", destination: "/docs-markdown/:slug*" }],
  // These routes readFile at request time; the bundler can't trace runtime
  // paths, so the files must be included in the serverless output explicitly.
  outputFileTracingIncludes: {
    "/api/chat": ["./content/docs/**/*", "./packages/chat/src/**/*"],
    "/docs-markdown/[...slug]": ["./content/docs/**/*"],
  },
};

const withMDX = createMDX();

export default withMDX(nextConfig);
