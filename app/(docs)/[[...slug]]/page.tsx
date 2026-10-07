import { ChevronRight } from "@keyline-icons/react";
import { notFound } from "next/navigation";
import { DocsTOC } from "@/components/docs/docs-toc";
import { DocsTopBarTrigger } from "@/components/docs/docs-top-bar-trigger";
import { PageActions } from "@/components/docs/page-actions";
import { ProgressiveBlur } from "@/components/ui/progressive-blur";
import { getPage, getSectionLabel, source } from "@/lib/docs/source";
import { getMDXComponents } from "@/mdx-components";

type PageProps = {
  params: Promise<{ slug?: string[] }>;
};

export default async function DocsPage(props: PageProps) {
  const { slug } = await props.params;
  const page = getPage(slug);
  if (!page) notFound();

  const MDXContent = page.data.body;
  // fumadocs uses an empty slug for the docs index; the raw-markdown route keys
  // off the on-disk filename.
  const markdownSlug = slug?.length ? slug : ["index"];
  const section = getSectionLabel(page.url);

  return (
    <div className="flex min-h-full flex-col">
      <header className="sticky top-0 z-10 isolate flex h-13 shrink-0 items-center justify-between gap-3 px-3">
        {/* Content dissolves under the bar instead of cutting off: a progressive
            blur plus a fade. */}
        <ProgressiveBlur
          direction="top"
          blurIntensity={0.5}
          className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-14 bg-linear-to-b from-secondary-bg to-transparent"
        />
        <div className="flex min-w-0 items-center gap-2">
          <DocsTopBarTrigger />
          <nav aria-label="Breadcrumb" className="flex min-w-0 items-center gap-1.5 text-sm">
            {section && (
              <>
                <span className="shrink-0 text-ink-secondary">{section}</span>
                <ChevronRight className="size-3 shrink-0 text-ink-tertiary" aria-hidden />
              </>
            )}
            <span className="truncate font-medium text-ink-primary">{page.data.title}</span>
          </nav>
        </div>
        <PageActions slug={markdownSlug} source={page.data.source} />
      </header>
      {/* isolate: demo z-indexes stay inside the page, below the sticky top bar. */}
      <div className="isolate flex flex-1">
        <div className="flex min-w-0 flex-1 justify-center px-5 pt-7 pb-24 md:px-12">
          <article className="w-full min-w-0 max-w-[680px]">
            <header id="overview" className="mb-7 flex scroll-mt-20 flex-col gap-2.5">
              <h1 className="font-semibold text-[32px] text-ink-primary leading-[38px] tracking-[-0.02em]">
                {page.data.title}
              </h1>
              {page.data.description && (
                <p className="max-w-[600px] text-ink-body text-xl leading-[26px]">
                  {page.data.description}
                </p>
              )}
            </header>
            <div className="[&>*:first-child]:mt-0 [&>h2:first-child]:border-0 [&>h2:first-child]:pt-0">
              <MDXContent components={getMDXComponents()} />
            </div>
          </article>
        </div>
        <DocsTOC items={page.data.toc} />
      </div>
    </div>
  );
}

export function generateStaticParams() {
  return source.generateParams();
}

export async function generateMetadata(props: PageProps) {
  const { slug } = await props.params;
  const page = getPage(slug);
  if (!page) notFound();

  return {
    title: page.data.title,
    description: page.data.description,
  };
}
