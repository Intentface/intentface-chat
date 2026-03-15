import type { ComponentProps } from "react";
import type { Components } from "streamdown";
import { Streamdown } from "streamdown";
import { cn } from "@/lib/utils";

const getDomain = (url: string) => {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
};

const isCitationLink = (href: string) => {
  try {
    const url = new URL(href);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
};

const CitationBadge = ({ href }: { href: string }) => {
  const domain = getDomain(href);

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-1 rounded-xs bg-slate-4 px-0.5 h-lh text-xs text-slate-11 no-underline transition-colors hover:bg-slate-4 hover:text-slate-12"
    >
      <img
        src={`https://www.google.com/s2/favicons?domain=${domain}&sz=32`}
        alt=""
        width={12}
        height={12}
        className="shrink-0 rounded-full"
      />
      <span>{domain}</span>
    </a>
  );
};

const markdownComponents: Components = {
  a: ({ href, children, node, ...props }) => {
    if (href && isCitationLink(href)) {
      return <CitationBadge href={href} />;
    }

    return (
      <a href={href} {...props}>
        {children}
      </a>
    );
  },
};

const Markdown = ({
  className,
  controls,
  components,
  ...props
}: ComponentProps<typeof Streamdown>) => (
  <Streamdown
    controls={false}
    components={{ ...markdownComponents, ...components }}
    className={cn(
      "text-md [&_p]:whitespace-pre-wrap [&>*:first-child]:mt-0 [&>*:last-child]:mb-0",
      className,
    )}
    {...props}
  />
);

export { Markdown };
