// Wire format for inline chip references inside a message text part.
// Shape: [Label](chip:prefix:value).

export const CHIP_REF_PATTERN = /\[([^\]]+)\]\(chip:([^:)]+):([^)]+)\)/g;

export type ChipSegment =
  | { type: "text"; text: string }
  | { type: "chip"; label: string; prefix: string; value: string };

export const escapeMarkdownLink = (input: string): string =>
  input.replace(/[[\]()\\]/g, (match) => `\\${match}`);

export const encodeChipMarkdown = (
  prefix: string,
  value: string,
  label: string,
): string => `[${escapeMarkdownLink(label)}](chip:${prefix}:${value})`;

export const parseChipSegments = (text: string): ChipSegment[] => {
  const segments: ChipSegment[] = [];
  let lastIndex = 0;
  for (const match of text.matchAll(CHIP_REF_PATTERN)) {
    const start = match.index;
    if (start > lastIndex) {
      segments.push({ type: "text", text: text.slice(lastIndex, start) });
    }
    segments.push({
      type: "chip",
      label: match[1],
      prefix: match[2],
      value: match[3],
    });
    lastIndex = start + match[0].length;
  }
  if (lastIndex < text.length) {
    segments.push({ type: "text", text: text.slice(lastIndex) });
  }
  return segments;
};

export type InlineNodeJSON =
  | { type: "text"; text: string }
  | {
      type: "mentionChip";
      attrs: { prefix: string; value: string; label: string };
    };

export type ParagraphNodeJSON = {
  type: "paragraph";
  content?: InlineNodeJSON[];
};

export const chipSegmentsToParagraphJSON = (
  segments: ChipSegment[],
): ParagraphNodeJSON[] => {
  const paragraphs: ParagraphNodeJSON[] = [{ type: "paragraph", content: [] }];
  const pushInline = (node: InlineNodeJSON) => {
    const target = paragraphs[paragraphs.length - 1];
    target.content = target.content ?? [];
    target.content.push(node);
  };

  for (const segment of segments) {
    if (segment.type === "text") {
      const lines = segment.text.split("\n");
      lines.forEach((line, lineIndex) => {
        if (lineIndex > 0) paragraphs.push({ type: "paragraph", content: [] });
        if (line.length > 0) pushInline({ type: "text", text: line });
      });
      continue;
    }
    pushInline({
      type: "mentionChip",
      attrs: {
        prefix: segment.prefix,
        value: segment.value,
        label: segment.label,
      },
    });
  }

  return paragraphs.filter((p) => (p.content?.length ?? 0) > 0);
};
