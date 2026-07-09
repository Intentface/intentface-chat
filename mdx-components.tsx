import type { MDXComponents } from "mdx/types";
import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";
import { AttributesTable } from "@/components/docs/attributes-table";
import { CodeBlock } from "@/components/docs/code-block";
import { ComponentPreview } from "@/components/docs/component-preview";
import { ManualInstall } from "@/components/docs/manual-install";
import { PropsTable } from "@/components/docs/props-table";
import { ThemeSource } from "@/components/docs/theme-source";
import { ValuesTable } from "@/components/docs/values-table";
import { cn } from "@/lib/utils";

// Slugify heading text into an id so the TOC anchors resolve. Mirrors the
// slugs fumadocs generates for the toc entries.
const slug = (children: ReactNode): string | undefined => {
  if (typeof children !== "string") return undefined;
  return children
    .toLowerCase()
    .replace(/[^\da-z]+/g, "-")
    .replace(/^-|-$/g, "");
};

const heading =
  (Tag: "h2" | "h3" | "h4", className: string) =>
  ({ children, ...props }: ComponentProps<"h2">) => (
    <Tag id={slug(children)} className={cn("scroll-mt-20", className)} {...props}>
      {children}
    </Tag>
  );

const proseComponents: MDXComponents = {
  h1: (props) => (
    <h1 className="font-semibold text-2xl text-ink-primary tracking-tight" {...props} />
  ),
  h2: heading(
    "h2",
    "mt-10 mb-3 font-semibold text-ink-primary text-xl",
  ),
  h3: heading("h3", "mt-8 mb-2 font-semibold text-ink-primary text-lg"),
  h4: heading("h4", "mt-6 mb-2 font-medium text-ink-primary"),
  p: (props) => <p className="my-4 text-lg text-ink-secondary leading-7" {...props} />,
  ul: (props) => (
    <ul className="my-4 ml-6 flex list-disc flex-col gap-2 text-lg text-ink-secondary" {...props} />
  ),
  ol: (props) => (
    <ol
      className="my-4 ml-6 flex list-decimal flex-col gap-2 text-lg text-ink-secondary"
      {...props}
    />
  ),
  li: (props) => <li className="text-lg leading-7" {...props} />,
  strong: (props) => <strong className="font-medium text-ink-primary" {...props} />,
  b: (props) => <b className="font-medium text-ink-primary" {...props} />,
  a: ({ href, ...props }: ComponentProps<"a">) => (
    <Link
      href={href ?? "#"}
      className="font-medium text-accent underline underline-offset-4 hover:text-accent-hover"
      {...props}
    />
  ),
  blockquote: (props) => (
    <blockquote
      className="my-4 border-accent border-l-2 pl-4 text-ink-tertiary italic"
      {...props}
    />
  ),
  table: (props) => (
    <div className="my-6 overflow-x-auto">
      <table className="w-full border-collapse text-sm" {...props} />
    </div>
  ),
  th: (props) => (
    <th
      className="border-secondary-border border-b px-3 py-2.5 align-top text-left font-medium text-ink-primary"
      {...props}
    />
  ),
  td: (props) => (
    <td className="border-secondary-border/60 border-b px-3 py-2.5 align-top text-ink-secondary" {...props} />
  ),
  // Inline code; fenced blocks arrive as <pre><code> and are handled by `pre`.
  code: (props) => (
    <code
      className="rounded border border-base-border bg-base px-1 py-px font-mono text-[0.85em] text-ink-primary"
      {...props}
    />
  ),
  pre: async ({ children }: ComponentProps<"pre">) => {
    // Built-in rehype highlighting is disabled (source.config.ts), so the code
    // element carries the raw source as its children — a string, or an array of
    // strings when MDX splits it. Flatten to a single string for CodeBlock.
    const child = children as { props?: { children?: unknown; className?: string } } | undefined;
    const rawChildren = child?.props?.children;
    const code = (Array.isArray(rawChildren) ? rawChildren.join("") : (rawChildren ?? ""))
      .toString()
      .replace(/\n$/, "");
    const lang = child?.props?.className?.replace(/^language-/, "") ?? "tsx";
    return <CodeBlock code={code} lang={lang} className="my-4" />;
  },
};

// Docs components available inside every MDX page without an import.
const docsComponents: MDXComponents = {
  ComponentPreview,
  ManualInstall,
  PropsTable,
  AttributesTable,
  ValuesTable,
  ThemeSource,
};

export const getMDXComponents = (components?: MDXComponents): MDXComponents => ({
  ...proseComponents,
  ...docsComponents,
  ...components,
});
