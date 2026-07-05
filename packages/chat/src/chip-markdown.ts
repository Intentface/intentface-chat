// Wire format for inline chip references inside a message text part.
// Shape: [Label](chip:prefix:value?icon=…). The icon rides along in the
// token, so a rendered message reconstructs the chip from its own text
// alone — no sidecar metadata array. Presentation that's derivable at render
// time (e.g. a per-prefix variant) is the renderer's job, not wire data.

/**
 * Opaque wire string. The styled layer owns the concrete union and narrows
 * at its own boundary.
 */
export type ChipIconKey = string;

export const CHIP_REF_PATTERN = /\[([^\]]+)\]\(chip:([^:)]+):([^)?]+)(?:\?([^)]*))?\)/g;

export type ChipData = {
  prefix: string;
  value: string;
  label: string;
  icon?: ChipIconKey;
};

export type ChipSegment =
  | { type: "text"; text: string }
  | {
      type: "chip";
      label: string;
      prefix: string;
      value: string;
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

export const encodeChipMarkdown = (chip: ChipData): string => {
  const params = new URLSearchParams();
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
    const [token, label = "", prefix = "", rawValue = "", rawQuery] = match;
    const params = new URLSearchParams(rawQuery ?? "");
    const icon = params.get("icon");
    segments.push({
      type: "chip",
      label,
      prefix,
      value: safeDecode(rawValue),
      ...(icon ? { icon } : {}),
    });
    lastIndex = start + token.length;
  }
  if (lastIndex < text.length) {
    segments.push({ type: "text", text: text.slice(lastIndex) });
  }
  return segments;
};

// Editor-node building (mentionChip / paragraph ProseMirror JSON) lives with
// the editor schema in composer/document.ts — this module is only the neutral
// wire format.
