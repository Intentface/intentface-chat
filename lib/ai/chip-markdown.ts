// Wire format for inline chip references inside a message text part.
// Shape: [Label](chip:prefix:value?variant=…&icon=…). The variant/icon ride
// along in the token, so a rendered message reconstructs the chip from its own
// text alone — no sidecar metadata array.

import type { ChipVariant } from "@/components/ai/chip";
import type { ChipIconKey } from "@/lib/ai/chip-icons";

export const CHIP_REF_PATTERN = /\[([^\]]+)\]\(chip:([^:)]+):([^)?]+)(?:\?([^)]*))?\)/g;

export type ChipSegment =
  | { type: "text"; text: string }
  | {
      type: "chip";
      label: string;
      prefix: string;
      value: string;
      variant?: ChipVariant;
      icon?: ChipIconKey;
    };

export const escapeMarkdownLink = (input: string): string =>
  input.replace(/[[\]()\\]/g, (match) => `\\${match}`);

// Tolerate legacy/un-encoded values — a stray "%" would otherwise throw and
// take the whole message render down with it.
const safeDecode = (value: string): string => {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
};

export const encodeChipMarkdown = (chip: {
  prefix: string;
  value: string;
  label: string;
  variant?: ChipVariant;
  icon?: ChipIconKey;
}): string => {
  const params = new URLSearchParams();
  if (chip.variant) params.set("variant", chip.variant);
  if (chip.icon) params.set("icon", chip.icon);
  const query = params.toString();
  const value = encodeURIComponent(chip.value);
  return `[${escapeMarkdownLink(chip.label)}](chip:${chip.prefix}:${value}${query ? `?${query}` : ""})`;
};

export const parseChipSegments = (text: string): ChipSegment[] => {
  const segments: ChipSegment[] = [];
  let lastIndex = 0;
  for (const match of text.matchAll(CHIP_REF_PATTERN)) {
    const start = match.index;
    if (start > lastIndex) {
      segments.push({ type: "text", text: text.slice(lastIndex, start) });
    }
    const params = new URLSearchParams(match[4] ?? "");
    const variant = params.get("variant");
    const icon = params.get("icon");
    segments.push({
      type: "chip",
      label: match[1],
      prefix: match[2],
      value: safeDecode(match[3]),
      ...(variant ? { variant: variant as ChipVariant } : {}),
      ...(icon ? { icon: icon as ChipIconKey } : {}),
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
      attrs: {
        prefix: string;
        value: string;
        label: string;
        variant?: ChipVariant;
        icon?: ChipIconKey;
      };
    };

export type ParagraphNodeJSON = {
  type: "paragraph";
  content?: InlineNodeJSON[];
};

export const chipSegmentsToParagraphJSON = (segments: ChipSegment[]): ParagraphNodeJSON[] => {
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
        ...(segment.variant ? { variant: segment.variant } : {}),
        ...(segment.icon ? { icon: segment.icon } : {}),
      },
    });
  }

  return paragraphs.filter((p) => (p.content?.length ?? 0) > 0);
};
