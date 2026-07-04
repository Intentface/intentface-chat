import { highlight } from "fumadocs-core/highlight";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

type CodeBlockProps = {
  code: string;
  lang?: string;
  /** Small label shown above the block (e.g. a target file path). */
  title?: ReactNode;
  className?: string;
};

// Server-side shiki highlight. Emits dual-theme spans (--shiki / --shiki-dark);
// the `.dark` activation rule lives in globals.css under the shiki section.
export const CodeBlock = async ({ code, lang = "tsx", title, className }: CodeBlockProps) => {
  const rendered = await highlight(code, {
    lang,
    themes: { light: "github-light", dark: "github-dark" },
    defaultColor: false,
    components: {
      pre: ({ className: preClassName, ...props }) => (
        <pre
          className={cn(
            "overflow-x-auto rounded-lg border border-primary-border bg-base p-4 text-sm leading-relaxed [scrollbar-width:thin]",
            preClassName,
          )}
          {...props}
        />
      ),
    },
  });

  return (
    <div className={cn("not-prose flex flex-col overflow-hidden", className)}>
      {title && (
        <div className="rounded-t-lg border border-primary-border border-b-0 bg-primary px-4 py-2 font-mono text-ink-tertiary text-xs">
          {title}
        </div>
      )}
      <div className={cn(title && "[&>pre]:rounded-t-none")}>{rendered}</div>
    </div>
  );
};
