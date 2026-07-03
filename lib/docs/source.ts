import type { StructuredData } from "fumadocs-core/mdx-plugins";
import { loader, type Page } from "fumadocs-core/source";
import type { TOCItemType } from "fumadocs-core/toc";
import type { MDXContent } from "mdx/types";
import { docs } from "@/.source/server";

export const source = loader(docs.toFumadocsSource(), {
  baseUrl: "/docs",
});

// The runtime doc-data shape: frontmatter + the compiled MDX outputs. We retype
// it here in one place because fumadocs-core v16's `loader` collapses the
// source's pageData generic to the base `PageData` — in `GeneratePage<I>` the
// Config type parameter only appears inside `VirtualFile<Config>` via indexed
// access (`Config['pageData']`), which TypeScript cannot invert, so it falls
// back to the `SourceConfig` default. The server runtime is non-lazy, so these
// fields are present synchronously.
export type DocPageData = {
  title: string;
  description?: string;
  icon?: string;
  full?: boolean;
  body: MDXContent;
  toc: TOCItemType[];
  structuredData: StructuredData;
};

export type DocPage = Page<undefined, DocPageData>;

export const getPage = (slug: string[] | undefined): DocPage | undefined =>
  source.getPage(slug) as DocPage | undefined;
