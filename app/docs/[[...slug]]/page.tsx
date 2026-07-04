import { notFound } from "next/navigation";
import { DocsTOC } from "@/components/docs/docs-toc";
import { PageActions } from "@/components/docs/page-actions";
import { getPage, source } from "@/lib/docs/source";
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

  return (
    <div className="mx-auto flex w-fit max-w-full gap-10">
      <article className="w-full max-w-3xl shrink-0 pb-16">
        <header id="overview" className="mb-4 flex flex-col gap-3">
          <h1 className="font-semibold text-2xl text-ink-primary tracking-tight">
            {page.data.title}
          </h1>
          {page.data.description && (
            <p className="text-lg text-ink-secondary leading-7">{page.data.description}</p>
          )}
          <PageActions slug={markdownSlug} source={page.data.source} />
        </header>
        <div className="[&>*:first-child]:mt-0">
          <MDXContent components={getMDXComponents()} />
        </div>
      </article>
      <DocsTOC items={page.data.toc} />
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
