import { readFile } from "node:fs/promises";
import path from "node:path";
import { expandDemos } from "@/lib/docs/expand-demos";

// Serves a doc page's .mdx as text/plain so "View as Markdown" opens the source
// in-browser (and pastes cleanly into an LLM). The slug maps directly to the
// file under content/docs, mirroring the fumadocs page route. Demos are inlined
// as code blocks so a reader that can't run the page still gets the source.
export async function GET(_request: Request, { params }: { params: Promise<{ slug: string[] }> }) {
  const { slug } = await params;

  // Reject anything that could escape content/docs; slugs are plain segments.
  if (!slug?.length || slug.some((segment) => segment.includes(".."))) {
    return new Response("Not found", { status: 404 });
  }

  const filePath = path.join(process.cwd(), "content", "docs", `${slug.join("/")}.mdx`);

  try {
    const source = await expandDemos(await readFile(filePath, "utf8"));
    return new Response(source, {
      headers: { "content-type": "text/plain; charset=utf-8" },
    });
  } catch {
    return new Response("Not found", { status: 404 });
  }
}
