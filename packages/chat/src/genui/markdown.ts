import type { Cell, ChartProps, KeyValueItem, Metric, TableProps } from "./fields";
import { type FormatOptions, formatValue, signedPercent } from "./format";

/**
 * Generated UI as portable text: Markdown to paste or store, and rows for a
 * CSV.
 *
 * Pure and deterministic. Every export is a function of the spec, not of the
 * model, so it works on any spec however old, costs nothing, and can never
 * disagree with what is on screen. The same Markdown is what a UI turns into
 * wherever pixels can't go: a model's history, a search index, a document an
 * agent reads later, a stored spec whose component no longer exists.
 */

/** A table of raw values: the first row is the header. */
export type Rows = Cell[][];

// ---------------------------------------------------------------------------
// Literal text
// ---------------------------------------------------------------------------
//
// Every string here was written by the model or came from a source, so it
// must read as written: it may not format, link, or break the structure
// around it. A cell that says `[click](https://…)` is text, not a link: links
// come only from the consumer, never from the content. That matters most
// where the Markdown outlives the screen — stored beside a spec, served to an
// agent, indexed.

// What opens emphasis, code, a link or image, an autolink or HTML,
// strikethrough, or a table cell; and `@`, which GFM turns into a mailto link.
const INLINE = /[\\`*_[\]<>|~@]/g;
// An entity reference (`&amp;`) would be decoded, so its ampersand is escaped.
const ENTITY = /&(?=#?[a-zA-Z0-9]+;)/g;
// GFM links a bare address too: `https://…`, `www.…`. Escaping the colon or
// the dot breaks the pattern and leaves the text as it was.
const SCHEME = /(https?|mailto|xmpp):/gi;
const WWW = /\b(www)\./gi;

const escapeChars = (text: string) =>
  text
    .replace(INLINE, "\\$&")
    .replace(ENTITY, "\\&")
    .replace(SCHEME, "$1\\:")
    .replace(WWW, "$1\\.");

/**
 * One line of literal text, for a label, a cell or a heading: line breaks
 * become spaces, and nothing in it can format or link.
 */
export const escapeMarkdownInline = (text: string) => escapeChars(oneLine(text));

/**
 * A run of whitespace that holds a line break, as one space. Each run is
 * matched once, whole, so this stays linear on text a model or a source
 * wrote: `\s*\n\s*` backtracks across a long run of spaces at every start.
 */
const oneLine = (text: string) => text.replace(/\s+/g, (run) => (run.includes("\n") ? " " : run));

/**
 * Literal text that may run over several lines, such as a paragraph. Each
 * line is escaped as `escapeMarkdownInline` escapes one, and a line that
 * would open a block (a heading, a list item, a rule, a setext underline) has
 * its marker escaped. Indentation is dropped, since four spaces would open a
 * code block; blank lines stay paragraph breaks.
 */
export const escapeMarkdown = (text: string) =>
  text
    .split("\n")
    .map((line) =>
      escapeChars(line.trim())
        .replace(/^([#+=-])/, "\\$1")
        .replace(/^(\d{1,9})([.)])/, "$1\\$2"),
    )
    .join("\n");

/** A heading of literal text. A trailing `#` stays text rather than closing the heading. */
export const markdownHeading = (level: number, text: string) =>
  `${"#".repeat(level)} ${escapeMarkdownInline(text).replace(/(^|\s)(#+)$/, "$1\\$2")}`;

/** A raw value as text, unescaped: `markdownTable` escapes what it is given. */
const plain = (cell: Cell | undefined) => (cell === null || cell === undefined ? "" : String(cell));

/**
 * A GitHub-flavoured Markdown table. Every cell is literal text: pipes can't
 * split a column, and nothing in a cell can format or link.
 */
export const markdownTable = (header: readonly string[], rows: readonly (readonly string[])[]) => {
  const line = (cells: readonly string[]) =>
    `| ${header.map((_, index) => escapeMarkdownInline(cells[index] ?? "")).join(" | ")} |`;
  return [line(header), `| ${header.map(() => "---").join(" | ")} |`, ...rows.map(line)].join("\n");
};

/**
 * RFC 4180: comma-separated, CRLF line ends, a field quoted when it holds a
 * comma, a quote or a line break. Prefixed with a byte-order mark, without
 * which Excel reads UTF-8 as Latin-1 and "€" arrives as "â‚¬".
 */
export const toCsv = (rows: Rows) =>
  `﻿${rows
    .map((row) =>
      row
        .map((cell) => {
          const text = cell === null || cell === undefined ? "" : String(cell);
          return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
        })
        .join(","),
    )
    .join("\r\n")}\r\n`;

/**
 * Tab-separated, which is what Sheets and Excel expect on paste — a CSV pasted
 * into a spreadsheet lands as one column of commas. Tabs and line breaks in a
 * cell become spaces, since a paste has no quoting to protect them.
 */
export const toTsv = (rows: Rows) =>
  rows
    .map((row) =>
      row
        .map((cell) =>
          cell === null || cell === undefined ? "" : String(cell).replace(/[\t\r\n]+/g, " "),
        )
        .join("\t"),
    )
    .join("\n");

/** Blocks of Markdown, one blank line apart, empties dropped. */
export const blocks = (...parts: (string | undefined | null | false)[]) =>
  parts
    .filter((part): part is string => typeof part === "string" && part.trim() !== "")
    .join("\n\n");

/** Blockquoted, every line, so a multi-line callout stays one quote. */
export const quote = (text: string) =>
  text
    .split("\n")
    .map((line) => `> ${line}`)
    .join("\n");

// ---------------------------------------------------------------------------
// The shared pieces: what a metric, a table and a chart read as
// ---------------------------------------------------------------------------

/** A labelled value as a list item: `- **Label:** value`, both literal. */
const labelled = (label: string, value: string) =>
  `- **${escapeMarkdownInline(label)}:** ${escapeMarkdownInline(value)}`;

export const metricLine = (metric: Metric, options: FormatOptions = {}) => {
  const value = formatValue(metric.value, metric.format, metric.currency, options);
  const change =
    metric.delta === undefined
      ? ""
      : ` (${signedPercent(metric.delta, options)}${metric.deltaLabel ? ` ${metric.deltaLabel}` : ""})`;
  return labelled(metric.label, `${value}${change}`);
};

export const keyValueLines = (items: readonly KeyValueItem[], options: FormatOptions = {}) =>
  items
    .map((item) =>
      labelled(item.label, formatValue(item.value, item.format, item.currency, options)),
    )
    .join("\n");

/** A table's rows as the reader saw them: formatted, in Markdown. */
export const tableMarkdown = ({ columns, rows }: TableProps, options: FormatOptions = {}) =>
  markdownTable(
    columns.map((column) => column.label),
    rows.map((row) =>
      columns.map((column, index) =>
        column.format
          ? formatValue(row[index], column.format, column.currency, options)
          : plain(row[index]),
      ),
    ),
  );

/** A table's rows for a spreadsheet: raw values, so numbers stay numbers. */
export const tableRows = ({ columns, rows }: TableProps): Rows => [
  columns.map((column) => column.label),
  ...rows.map((row) => columns.map((_, index) => row[index] ?? null)),
];

/**
 * A chart as the table it was drawn from: one row per category, one column
 * per series. A pie has one series, so it is two columns.
 */
export const chartRows = ({ kind, categories, series }: ChartProps): Rows => {
  const shown = kind === "pie" ? series.slice(0, 1) : series;
  return [
    ["", ...shown.map((entry) => entry.label)],
    ...categories.map((category, index) => [
      category,
      ...shown.map((entry) => entry.values[index] ?? null),
    ]),
  ];
};

export const chartMarkdown = (props: ChartProps, options: FormatOptions = {}) => {
  const [header = [], ...rows] = chartRows(props);
  return markdownTable(
    header.map((cell) => plain(cell)),
    rows.map(([category, ...values]) => [
      plain(category),
      ...values.map((value) => formatValue(value, props.format, props.currency, options)),
    ]),
  );
};
