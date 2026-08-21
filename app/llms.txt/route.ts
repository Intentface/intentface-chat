import type { ReactNode } from "react";
import { getPage, source } from "@/lib/docs/source";

const SITE = "https://ui.intentface.com";

// The intro is read by agents, so it carries the two operating instructions
// that save a round trip: how to fetch a page, and which Tailwind version the
// demos assume.
const SUMMARY = [
  "This is the documentation for the `@intentface/chat` package.",
  "It provides headless, unstyled React primitives for building AI chat interfaces — a rich-text composer, thread scroll ownership, message segmentation, and streaming disclosure. Styling is entirely the consumer's.",
  "Every page below is markdown; append `.md` to any docs URL to fetch the same content. Demo source is inlined into those pages.",
  "The demos are written for Tailwind CSS v4. If `package.json` uses Tailwind CSS v3, convert unsupported utilities to v3-compatible equivalents.",
].join("\n");

type TreeNode = {
  type: string;
  name?: ReactNode;
  url?: string;
  children?: TreeNode[];
};

// Page tree names are ReactNode; ours come from frontmatter, so they're strings.
const asText = (value: ReactNode): string => (typeof value === "string" ? value : "");

// "/primitives/composer" -> "primitives/composer"; "/" -> "index"
const slugOf = (url: string) => url.replace(/^\//, "") || "index";

const lineFor = (url: string) => {
  const slug = slugOf(url);
  const page = getPage(slug === "index" ? [] : slug.split("/"));
  if (!page) return null;
  const description = page.data.description ? `: ${page.data.description}` : "";
  return `- [${page.data.title}](${SITE}/${slug}.md)${description}`;
};

// Groups follow the page tree, so the order matches the sidebar.
const sectionsOf = (nodes: TreeNode[]) => {
  const loose: string[] = [];
  const groups: { title: string; lines: string[] }[] = [];

  for (const node of nodes) {
    if (node.type === "page" && node.url) {
      const line = lineFor(node.url);
      if (line) loose.push(line);
    }
    if (node.type === "folder") {
      const lines = (node.children ?? [])
        .filter((child) => child.type === "page" && child.url)
        .map((child) => lineFor(child.url as string))
        .filter((line): line is string => line !== null);
      if (lines.length) groups.push({ title: asText(node.name) || "Pages", lines });
    }
  }

  return { loose, groups };
};

// llms.txt — a flat, ordered index so an agent can find the docs without
// crawling rendered HTML. Pairs with /docs-markdown/<slug>, which serves each
// page as markdown with demo source expanded inline.
export const dynamic = "force-static";

export const GET = () => {
  const { loose, groups } = sectionsOf(source.pageTree.children as TreeNode[]);

  const body = [
    "# @intentface/chat",
    "",
    SUMMARY,
    "",
    "## Documentation",
    "",
    ...loose,
    ...groups.flatMap(({ title, lines }) => ["", `## ${title}`, "", ...lines]),
    "",
  ].join("\n");

  return new Response(body, {
    headers: { "content-type": "text/plain; charset=utf-8" },
  });
};
