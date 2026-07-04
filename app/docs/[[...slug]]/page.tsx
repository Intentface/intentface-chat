import { notFound } from "next/navigation";
import { DocsTOC } from "@/components/docs/docs-toc";
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

  return (
    <div className="mx-auto flex w-fit max-w-full gap-10">
      <article className="w-full max-w-3xl shrink-0 pb-16">
        <header id="overview" className="mb-8 flex flex-col gap-2">
          <h1 className="font-semibold text-2xl text-ink-primary tracking-tight">
            {page.data.title}
          </h1>
          {page.data.description && (
            <p className="text-ink-secondary text-md">{page.data.description}</p>
          )}
        </header>
        <MDXContent components={getMDXComponents()} />
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
