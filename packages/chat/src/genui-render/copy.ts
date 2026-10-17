// Copying a selection that touches a generated UI. No React and no directive:
// plain DOM, run from the host's copy handler.
//
// A UI on screen is a grid of boxes; copied as it renders, a table becomes a
// run of words and a chart becomes nothing. So a selection that touches a UI
// copies that UI's whole Markdown in place of its on-screen text: half a table
// isn't meaningful Markdown, so even a partial selection copies all of it.

/** Each `GenUi.Part` on screen, by the id its element carries: how to read its UI as Markdown. */
const parts = new Map<string, () => string>();

/** Registers a part's Markdown. Returns the unregister. */
export const registerPart = (id: string, markdown: () => string) => {
  parts.set(id, markdown);
  return () => {
    if (parts.get(id) === markdown) parts.delete(id);
  };
};

const PART = "data-genui-part";

const BLOCK = new Set([
  "ADDRESS",
  "ARTICLE",
  "ASIDE",
  "BLOCKQUOTE",
  "DD",
  "DETAILS",
  "DIV",
  "DL",
  "DT",
  "FIELDSET",
  "FIGCAPTION",
  "FIGURE",
  "FOOTER",
  "FORM",
  "H1",
  "H2",
  "H3",
  "H4",
  "H5",
  "H6",
  "HEADER",
  "HR",
  "LI",
  "MAIN",
  "NAV",
  "OL",
  "P",
  "PRE",
  "SECTION",
  "SUMMARY",
  "TABLE",
  "TR",
  "UL",
]);

/**
 * A fragment as plain text, the way it reads: block elements on their own
 * lines, table cells tab-separated, whitespace collapsed as rendering does.
 * A `<pre>` keeps its text as written, which is how a part's Markdown rides.
 */
export const fragmentText = (node: Node): string => {
  let out = "";
  const visit = (current: Node) => {
    if (current.nodeType === 3) {
      out += (current.textContent ?? "").replace(/\s+/g, " ");
      return;
    }
    if (current.nodeType !== 1 && current.nodeType !== 11) return;
    const element = current as Element;
    const tag = current.nodeType === 1 ? element.tagName : "";
    if (tag === "BR") {
      out += "\n";
      return;
    }
    if (tag === "PRE") {
      out += `\n\n${current.textContent ?? ""}\n\n`;
      return;
    }
    const block = BLOCK.has(tag);
    if (block) out += "\n";
    for (const child of Array.from(current.childNodes)) visit(child);
    if (tag === "TD" || tag === "TH") out += "\t";
    if (block) out += "\n";
  };
  visit(node);
  return out
    .split("\n")
    .map((line) => line.replace(/[ \t]+$/, "").replace(/^ +/, ""))
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
};

/**
 * A range as plain text, each part it touches read as its whole Markdown.
 * Null when it touches no part: the browser's own copy is better then.
 */
export const rangeText = (range: Range): string | null => {
  const start = range.commonAncestorContainer;
  const startElement = start.nodeType === 1 ? (start as Element) : start.parentElement;

  // Wholly inside one part: the part, whole.
  const within = startElement?.closest(`[${PART}]`)?.getAttribute(PART);
  const read = within ? parts.get(within) : undefined;
  if (read) return read();

  const fragment = range.cloneContents();
  const touched = Array.from(fragment.querySelectorAll(`[${PART}]`)).filter((element) =>
    parts.has(element.getAttribute(PART) ?? ""),
  );
  if (touched.length === 0) return null;

  // Outermost first, so a part inside another is read as part of it.
  for (const element of touched) {
    if (!fragment.contains(element)) continue;
    const markdown = parts.get(element.getAttribute(PART) ?? "")?.() ?? "";
    const pre = (element.ownerDocument ?? document).createElement("pre");
    pre.textContent = markdown;
    element.replaceWith(pre);
  }
  return fragmentText(fragment);
};

/**
 * The copy handler for wherever generated UI is drawn: a thread, a message,
 * a document. When the selection touches a `GenUi.Part`, the clipboard gets
 * plain text with each touched UI as its whole Markdown, at the reader's
 * state; otherwise the browser copies as it always does.
 *
 *     <div onCopy={copyWithGenUi}>…</div>
 */
export const copyWithGenUi = (event: {
  clipboardData: DataTransfer | null;
  preventDefault(): void;
}) => {
  if (typeof window === "undefined" || !event.clipboardData) return;
  const selection = window.getSelection();
  if (!selection || selection.isCollapsed || selection.rangeCount === 0) return;
  const text = rangeText(selection.getRangeAt(0));
  if (text === null) return;
  event.clipboardData.setData("text/plain", text);
  event.preventDefault();
};
