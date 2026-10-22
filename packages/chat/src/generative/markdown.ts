// A tree as Markdown, and the escaping that keeps model-written text literal.

import { type AnyCatalog, componentOf, isBinding, isObject, type Tree } from "./catalog";

// ---------------------------------------------------------------------------
// Markdown
// ---------------------------------------------------------------------------
//
// Text from the model or a source must read as written: it may not format,
// link, or break the structure around it. Links come only from the consumer.

// What opens emphasis, code, a link or image, HTML, strikethrough or a table
// cell; and `@`, which GFM turns into a mailto link.
const INLINE = /[\\`*_[\]<>|~@]/g;
// An entity reference (`&amp;`) would be decoded, so its ampersand is escaped.
const ENTITY = /&(?=#?[a-zA-Z0-9]+;)/g;
// GFM links bare addresses too; escaping the colon or the dot breaks the pattern.
const SCHEME = /(https?|mailto|xmpp):/gi;
const WWW = /\b(www)\./gi;

const escapeCharacters = (text: string) =>
  text
    .replace(INLINE, "\\$&")
    .replace(ENTITY, "\\&")
    .replace(SCHEME, "$1\\:")
    .replace(WWW, "$1\\.");

// A lone `\r` ends a line in Markdown, the same as `\n`.
const LINE_BREAK = /[\r\n]/;

// Each run of whitespace is matched once, whole, so this stays linear on long runs.
const oneLine = (text: string) => text.replace(/\s+/g, (run) => (LINE_BREAK.test(run) ? " " : run));

/** One line of literal text, for a label, a cell or a heading. */
export const escapeMarkdownInline = (text: string): string => escapeCharacters(oneLine(text));

/**
 * Literal text over several lines, such as a paragraph. A line that would open
 * a block has its marker escaped, and indentation is dropped.
 */
export const escapeMarkdown = (text: string): string =>
  text
    .split(/\r\n?|\n/)
    .map((line) =>
      escapeCharacters(line.trim())
        .replace(/^([#+=-])/, "\\$1")
        .replace(/^(\d{1,9})([.)])/, "$1\\$2"),
    )
    .join("\n");

/** A heading of literal text. A trailing `#` stays text. */
export const markdownHeading = (level: number, text: string): string =>
  `${"#".repeat(level)} ${escapeMarkdownInline(text).replace(/(^|\s)(#+)$/, "$1\\$2")}`;

/** A GitHub-flavoured table. Every cell is literal text, so a pipe can't split a column. */
export const markdownTable = (
  header: readonly string[],
  rows: readonly (readonly unknown[])[],
): string => {
  const line = (cells: readonly unknown[]) =>
    `| ${header.map((_, index) => escapeMarkdownInline(String(cells[index] ?? ""))).join(" | ")} |`;
  return [line(header), `| ${header.map(() => "---").join(" | ")} |`, ...rows.map(line)].join("\n");
};

const hasBinding = (props: unknown) => isObject(props) && Object.values(props).some(isBinding);

/**
 * A tree as Markdown, through each component's `markdown`. A container
 * without one reads as its children. An element still holding a binding is
 * left out: resolve the tree first.
 */
export const toMarkdown = <C extends AnyCatalog>(tree: Tree<C>, catalog: C): string => {
  // Each element writes once, so a cycle or a shared child in a stored tree stops at the first.
  const written = new Set<string>();
  const write = (id: string): string => {
    const element = tree.elements[id];
    if (!element || written.has(id) || hasBinding(element.props)) return "";
    written.add(id);
    const children = (element.children ?? [])
      .map((child) => write(child))
      .filter((block) => block.trim() !== "")
      .join("\n\n");
    const definition = componentOf(catalog, element.type);
    // Typed per component in the catalog; the element's props are that component's.
    if (definition?.markdown) return definition.markdown(element.props as never, children);
    if (definition?.container) return children;
    throw new Error(`"${element.type}" has no markdown.`);
  };
  return write(tree.root);
};
