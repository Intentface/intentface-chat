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

const cellText = (cell: Cell | undefined) =>
  cell === null || cell === undefined ? "" : String(cell).replace(/\s*\n\s*/g, " ");

/** A GitHub-flavoured Markdown table. Pipes are escaped so a cell can't split a column. */
export const markdownTable = (header: readonly string[], rows: readonly (readonly string[])[]) => {
  const line = (cells: readonly string[]) =>
    `| ${header.map((_, index) => cellText(cells[index]).replace(/\|/g, "\\|")).join(" | ")} |`;
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

export const metricLine = (metric: Metric, options: FormatOptions = {}) => {
  const value = formatValue(metric.value, metric.format, metric.currency, options);
  const change =
    metric.delta === undefined
      ? ""
      : ` (${signedPercent(metric.delta, options)}${metric.deltaLabel ? ` ${metric.deltaLabel}` : ""})`;
  return `- **${metric.label}:** ${value}${change}`;
};

export const keyValueLines = (items: readonly KeyValueItem[], options: FormatOptions = {}) =>
  items
    .map(
      (item) =>
        `- **${item.label}:** ${formatValue(item.value, item.format, item.currency, options)}`,
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
          : cellText(row[index]),
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
    header.map((cell) => cellText(cell)),
    rows.map(([category, ...values]) => [
      cellText(category),
      ...values.map((value) => formatValue(value, props.format, props.currency, options)),
    ]),
  );
};
