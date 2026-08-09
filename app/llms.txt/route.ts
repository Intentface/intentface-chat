import type { ReactNode } from "react";
import { getPage, source } from "@/lib/docs/source";

const SITE = "https://intentface.dev";

const SUMMARY =
  "Headless chat UI primitives for React — the behavior, state, and wire formats for building AI chat interfaces, with no styling of their own. Each documentation page below is served as plain markdown with every demo's source inlined.";

type TreeNode = {
  type: string;
  name?: ReactNode;
  url?: string;
  children?: TreeNode[];
};

// Page tree names are ReactNode; ours come from frontmatter, so they're strings.
const asText = (value: ReactNode): string => (typeof value === "string" ? value : "");

// "/docs/primitives/composer" -> "primitives/composer"; "/docs" -> "index"
const slugOf = (url: string) => url.replace(/^\/docs\/?/, "") || "index";

const lineFor = (url: string) => {
  const slug = slugOf(url);
  const page = getPage(slug === "index" ? [] : slug.split("/"));
  if (!page) return null;
  const description = page.data.description ? `: ${page.data.description}` : "";
  return `- [${page.data.title}](${SITE}/docs-markdown/${slug})${description}`;
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
    `> ${SUMMARY}`,
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
