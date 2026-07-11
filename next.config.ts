import { createMDX } from "fumadocs-mdx/next";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@intentface/chat"],
  // These routes readFile at request time; the bundler can't trace runtime
  // paths, so the files must be included in the serverless output explicitly.
  outputFileTracingIncludes: {
    "/api/chat": ["./content/docs/**/*", "./packages/chat/src/**/*"],
    "/docs-markdown/[...slug]": ["./content/docs/**/*"],
  },
};

const withMDX = createMDX();

export default withMDX(nextConfig);
