import { createMDX } from "fumadocs-mdx/next";
import type { NextConfig } from "next";

// `exports` in packages/chat points at ./dist for consumers, so map each
// subpath back to source here — the app compiles package source with no build
// step. Entries are explicit rather than a wildcard: Turbopack resolveAlias
// matches request strings, not glob patterns.
const chatSourceAliases = {
  "@intentface/chat/types": "./packages/chat/src/types.ts",
  "@intentface/chat/composer": "./packages/chat/src/composer/index.ts",
  "@intentface/chat/chip": "./packages/chat/src/chip/index.ts",
  "@intentface/chat/thread": "./packages/chat/src/thread/index.ts",
  "@intentface/chat/reasoning": "./packages/chat/src/reasoning/index.ts",
  "@intentface/chat/steps": "./packages/chat/src/steps/index.ts",
  "@intentface/chat/attachments": "./packages/chat/src/attachments/index.ts",
  "@intentface/chat/ask": "./packages/chat/src/ask/index.ts",
  "@intentface/chat/message": "./packages/chat/src/message/index.ts",
  "@intentface/chat/message-utils": "./packages/chat/src/message-utils.ts",
  "@intentface/chat/chip-markdown": "./packages/chat/src/chip-markdown.ts",
};

const nextConfig: NextConfig = {
  transpilePackages: ["@intentface/chat"],
  turbopack: { resolveAlias: chatSourceAliases },
  // Any docs page is readable as markdown by appending `.md` — the convention
  // agents expect, and guessable from a page URL. It maps onto the same handler
  // that "View as Markdown" uses.
  rewrites: async () => [{ source: "/:slug*.md", destination: "/docs-markdown/:slug*" }],
  // These routes readFile at request time; the bundler can't trace runtime
  // paths, so the files must be included in the serverless output explicitly.
  outputFileTracingIncludes: {
    "/api/chat": ["./content/docs/**/*", "./packages/chat/src/**/*"],
    "/docs-markdown/[...slug]": ["./content/docs/**/*"],
  },
};

const withMDX = createMDX();

export default withMDX(nextConfig);
