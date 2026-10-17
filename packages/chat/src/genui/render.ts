import type { Cell, ChartProps, Format, KeyValueItem, Metric, TableProps, Tone } from "./fields";
import {
  categoryLabel,
  type FormatOptions,
  formatTick,
  formatValue,
  isNumeric,
  signedPercent,
} from "./format";

/**
 * Render props: what a component is handed, as opposed to what the model
 * wrote.
 *
 * Schema props are shaped for the model — rows as arrays, raw numbers, no
 * handlers — because they cost output tokens. Render props are shaped for a
 * design system: every value already formatted, alignment decided, tone
 * worked out. The logic lives here, once, so two hosts with different
 * components give one answer the same reading; a component only draws.
 *
 * Pure and React-free, like the rest of the core: a server can compute them,
 * and a test can assert on them without a DOM.
 */

/** One value as drawn: the raw value, its text, and a link once targets resolve (L0). */
export type DisplayCell = { value: Cell; text: string; href?: string };

export type MetricRender = {
  label: string;
  /** The value, formatted. */
  text: string;
  delta?: {
    /** The change, signed: `+8%`, `−2%`. */
    text: string;
    /** What it is against, e.g. "vs last week". */
    label?: string;
    direction: "up" | "down" | "flat";
    tone: Tone;
  };
  /** The schema's own tone, else the change's: positive for a rise, negative for a fall. */
  tone: Tone;
};

export const metricRender = (metric: Metric, options: FormatOptions = {}): MetricRender => {
  const { delta } = metric;
  const text = formatValue(metric.value, metric.format, metric.currency, options);
  if (delta === undefined) return { label: metric.label, text, tone: metric.tone ?? "neutral" };
  const direction = delta > 0 ? "up" : delta < 0 ? "down" : "flat";
  const tone =
    metric.tone ??
    (direction === "up" ? "positive" : direction === "down" ? "negative" : "neutral");
  return {
    label: metric.label,
    text,
    delta: {
      text: signedPercent(delta, options),
      ...(metric.deltaLabel ? { label: metric.deltaLabel } : {}),
      direction,
      tone,
    },
    tone,
  };
};

export type KeyValueRender = { items: { label: string; value: Cell; text: string }[] };

export const keyValueItems = (
  items: readonly KeyValueItem[],
  options: FormatOptions = {},
): KeyValueRender["items"] =>
  items.map((item) => ({
    label: item.label,
    value: item.value,
    text: formatValue(item.value, item.format, item.currency, options),
  }));

export type ColumnRender = {
  /** Identifies the column. The label until column keys arrive (L0), made unique. */
  key: string;
  label: string;
  align: "left" | "right";
  /** How its cells are drawn. Always `text` until display variants arrive (L0). */
  display: "text" | "badge" | "link" | "bar";
  /** Whether its header sorts the table. Always false until sorting arrives (L0). */
  sortable: boolean;
  format?: Format;
};

export type DataTableRender = {
  columns: ColumnRender[];
  /** Each row's cells in column order. Keyed by the row's position in the source. */
  rows: { key: string; cells: DisplayCell[] }[];
  /** Rows in the source, and rows left after search and filter (L0): the same until then. */
  count: { total: number; matching: number };
};

/** A cell as the Markdown export writes it: formatted when its column has a format. */
const cellText = (
  cell: Cell | undefined,
  format?: Format,
  currency?: string,
  options?: FormatOptions,
) =>
  format
    ? formatValue(cell, format, currency, options)
    : cell === null || cell === undefined
      ? ""
      : String(cell);

export const tableRender = (
  { columns, rows }: TableProps,
  options: FormatOptions = {},
): DataTableRender => {
  const seen = new Map<string, number>();
  return {
    columns: columns.map((column, index) => {
      const count = (seen.get(column.label) ?? 0) + 1;
      seen.set(column.label, count);
      const values = rows
        .map((row) => row[index])
        .filter((cell) => cell !== null && cell !== undefined);
      const numeric =
        isNumeric(column.format) ||
        (!column.format && values.length > 0 && values.every((cell) => typeof cell === "number"));
      return {
        key: count === 1 ? column.label : `${column.label} ${count}`,
        label: column.label,
        align: column.align ?? (numeric ? "right" : "left"),
        display: "text",
        sortable: false,
        ...(column.format ? { format: column.format } : {}),
      };
    }),
    rows: rows.map((row, index) => ({
      key: String(index),
      cells: columns.map((column, at) => {
        const value = row[at] ?? null;
        return { value, text: cellText(value, column.format, column.currency, options) };
      }),
    })),
    count: { total: rows.length, matching: rows.length },
  };
};

export type ChartRender = {
  kind: ChartProps["kind"];
  /** The x-axis labels or slices, as shown: a full ISO date reads as a date. */
  categories: string[];
  /** The series to draw. A pie draws only the first. */
  series: ChartProps["series"];
  stacked: boolean;
  format?: Format;
  /** A value as a tooltip shows it. */
  formatValue(value: number): string;
  /** A value as an axis tick shows it: shorter. */
  formatTick(value: number): string;
};

export const chartRender = (props: ChartProps, options: FormatOptions = {}): ChartRender => ({
  kind: props.kind,
  categories: props.categories.map((category) => categoryLabel(category, options)),
  series: props.kind === "pie" ? props.series.slice(0, 1) : props.series,
  stacked: props.stacked ?? false,
  ...(props.format ? { format: props.format } : {}),
  formatValue: (value) => formatValue(value, props.format, props.currency, options),
  formatTick: (value) => formatTick(value, props.format, props.currency, options),
});

export type MetricsRender = { items: MetricRender[] };

export type RecordRender = {
  name: string;
  subtitle?: string;
  status?: { label: string; tone: Tone };
  fields: KeyValueRender["items"];
  note?: string;
};

export type StepsRender = {
  items: { key: string; title: string; detail?: string; status: "todo" | "current" | "done" }[];
};
