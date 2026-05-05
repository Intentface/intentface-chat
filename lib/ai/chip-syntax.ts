// Wire format for inline chip references inside a message text part.
// Shape: [Label](chip:prefix:value).

export const CHIP_REF_PATTERN = /\[([^\]]+)\]\(chip:([^:)]+):([^)]+)\)/g;

export type ChipSegment =
  | { type: "text"; text: string }
  | { type: "chip"; label: string; prefix: string; value: string };

export const escapeMarkdownLink = (input: string): string =>
  input.replace(/[[\]()\\]/g, (match) => `\\${match}`);

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
