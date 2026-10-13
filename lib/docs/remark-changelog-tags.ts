// CHANGELOG.md tags a line with plain-text brackets ("- [Thread] Fix …") so it
// reads on GitHub too. On the changelog page, the leading tags become badges.

type MarkdownNode = {
  type: string;
  value?: string;
  children?: MarkdownNode[];
  data?: Record<string, unknown>;
};

const LEADING_TAGS = /^(?:\[\w+\] )+/;

// Each tag's dot colour as an OKLCH hue. A tag missing here gets a grey dot.
const TAG_HUES: Record<string, number> = {
  Breaking: 25,
  Nav: 65,
  Shell: 95,
  AskUser: 125,
  Attachments: 150,
  Steps: 175,
  Message: 200,
  Thread: 230,
  Composer: 258,
  Reasoning: 290,
  Chip: 320,
  Tabs: 345,
};

const badge = (name: string): MarkdownNode => {
  const hue = TAG_HUES[name];
  return {
    type: "emphasis",
    data: {
      hName: "span",
      hProperties: {
        className:
          "mr-1.5 inline-flex h-5 items-center gap-1.5 rounded-[5px] bg-ink-primary/7 px-1.5 font-medium text-ink-primary text-xs before:size-1.5 before:rounded-full before:bg-[var(--tag-color,var(--color-ink-tertiary))]",
        style: hue === undefined ? undefined : `--tag-color: oklch(0.68 0.14 ${hue})`,
      },
    },
    children: [{ type: "text", value: name }],
  };
};

const tagListItem = (item: MarkdownNode) => {
  const paragraph = item.children?.[0];
  const text = paragraph?.children?.[0];
  const tags = text?.type === "text" ? text.value?.match(LEADING_TAGS)?.[0] : undefined;
  if (!paragraph?.children || !text?.value || !tags) return;

  text.value = text.value.slice(tags.length);
  paragraph.children.unshift(...(tags.match(/\w+/g) ?? []).map(badge));
};

const visit = (node: MarkdownNode) => {
  if (node.type === "listItem") tagListItem(node);
  node.children?.forEach(visit);
};

export const remarkChangelogTags = () => (tree: MarkdownNode, file: { path?: string }) => {
  if (file.path?.endsWith("changelog.mdx")) visit(tree);
};
