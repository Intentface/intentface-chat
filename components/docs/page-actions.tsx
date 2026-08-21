import { GitHubIcon } from "@/components/icons/github";
import { MarkdownIcon } from "@/components/icons/markdown";
import Button from "@/components/ui/button";

const REPO = "https://github.com/Intentface/intentface-chat";

type PageActionsProps = {
  slug: string[];
  // Component path under packages/chat/src (frontmatter `source`); omitted on
  // pages that document no single component.
  source?: string;
};

const actionButtonClass =
  "h-9 rounded-full px-4 text-md font-medium text-ink-secondary hover:bg-secondary-bg-hover hover:text-ink-primary";

// "View as Markdown" (raw .mdx as text) + "Primitive source" (the headless
// component on GitHub — not the demos), mirroring Base UI's page header.
export const PageActions = ({ slug, source }: PageActionsProps) => (
  <div className="flex items-center gap-2">
    <Button
      variant="ghost"
      className={actionButtonClass}
      render={
        <a href={`/${slug.join("/")}.md`} target="_blank" rel="noreferrer">
          <MarkdownIcon />
          View as Markdown
        </a>
      }
    />
    {source && (
      <Button
        variant="ghost"
        className={actionButtonClass}
        render={
          <a
            href={`${REPO}/tree/main/packages/chat/src/${source}`}
            target="_blank"
            rel="noreferrer"
          >
            <GitHubIcon />
            Primitive source
          </a>
        }
      />
    )}
  </div>
);
