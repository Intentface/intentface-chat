// Demo chrome, not part of generative UI: JSON laid out for a narrow code
// pane. Kept apart from the components in frame.tsx so Fast Refresh can keep
// their state.

/**
 * JSON packed to fit a narrow pane: as many entries on a line as fit, and a
 * value broken over lines only when it can't fit on one.
 */
export const formatJson = (value: unknown, width = 35): string => {
  const inline = (item: unknown): string => {
    if (Array.isArray(item)) return `[${item.map(inline).join(", ")}]`;
    if (item && typeof item === "object") {
      const entries = Object.entries(item);
      if (entries.length === 0) return "{}";
      return `{ ${entries.map(([key, inner]) => `${JSON.stringify(key)}: ${inline(inner)}`).join(", ")} }`;
    }
    return JSON.stringify(item) ?? "null";
  };
  // `column` is where the value starts on its first line.
  const format = (item: unknown, indent: string, column: number): string => {
    const flat = inline(item);
    if (item === null || typeof item !== "object" || column + flat.length <= width) return flat;
    const array = Array.isArray(item);
    const entries = array
      ? (item as unknown[]).map((entry) => ["", entry] as const)
      : Object.entries(item).map(([key, entry]) => [`${JSON.stringify(key)}: `, entry] as const);
    const inner = `${indent}  `;
    let out = array ? "[" : "{ ";
    entries.forEach(([key, entry], index) => {
      const last = index === entries.length - 1;
      const comma = last ? "" : ",";
      const piece = `${key}${inline(entry)}${comma}`;
      // The last entry leaves room for the brackets that close after it.
      const room = width - (last ? 4 : 0);
      const at = out.includes("\n") ? out.length - out.lastIndexOf("\n") - 1 : column + out.length;
      const space = index === 0 ? "" : " ";
      if (at + space.length + piece.length <= room) out += space + piece;
      else if (inner.length + piece.length <= room) out = `${out.trimEnd()}\n${inner}${piece}`;
      else {
        const broken = format(entry, inner, inner.length + key.length);
        out = `${out.trimEnd()}\n${inner}${key}${broken}${comma}`;
      }
    });
    return `${out}${array ? "]" : " }"}`;
  };
  return format(value, "", 0);
};
