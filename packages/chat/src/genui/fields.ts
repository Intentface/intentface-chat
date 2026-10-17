import { z } from "zod";

/**
 * The prop shapes more than one component shares.
 *
 * Every schema here is read three ways: by the model, as a tool's JSON schema
 * (so `.describe()` is the documentation it gets); by the server, which
 * refuses what doesn't parse; and by the renderer, which only ever draws what
 * does. One definition keeps those three from disagreeing.
 *
 * Closed enums wherever the choice is about presentation. Nothing here takes a
 * colour, a class name or a style: how a component looks is the consumer's
 * theme, never something the model wrote. That is what lets a stored spec
 * re-skin itself when the theme changes.
 */

export const FORMATS = ["number", "currency", "percent", "date", "text"] as const;

export const FormatSchema = z
  .enum(FORMATS)
  .describe(
    "How to show the value. percent takes the percentage itself (12.5 means 12.5%); date takes an ISO date.",
  );

export type Format = z.infer<typeof FormatSchema>;

/** ISO 4217. Only read when the format is currency. */
export const CurrencySchema = z
  .string()
  .regex(/^[A-Z]{3}$/)
  .describe("ISO currency code, e.g. EUR. Only with the currency format.");

export const ToneSchema = z.enum(["neutral", "positive", "negative", "warning"]);
export type Tone = z.infer<typeof ToneSchema>;

export const CellSchema = z.union([z.string(), z.number(), z.null()]);
export type Cell = z.infer<typeof CellSchema>;

// ---------------------------------------------------------------------------
// Tables
// ---------------------------------------------------------------------------

export const ColumnSchema = z.object({
  label: z.string().max(80),
  align: z.enum(["left", "right"]).optional().describe("Right for numbers. Inferred when omitted."),
  format: FormatSchema.optional(),
  currency: CurrencySchema.optional(),
});

export type Column = z.infer<typeof ColumnSchema>;

/**
 * Rows as arrays in column order: an object per row repeats every column
 * name on every row, which for a long table is most of the tokens.
 */
export const tablePropsSchema = (maxRows: number = DEFAULT_MAX_ROWS) =>
  z.object({
    columns: z.array(ColumnSchema).min(1).max(12),
    rows: z
      .array(z.array(CellSchema))
      .max(maxRows)
      .describe("Each row is an array of cells in column order. null for an empty cell."),
  });

/**
 * Enough for a chat answer, where more rows than this belong in a download.
 * A document or a slide may want another cap: `createDefaultCatalog` takes
 * one, and builds its tables with it. A cap is part of the schema the model is
 * sent, which is why it is built in rather than checked afterwards.
 */
export const DEFAULT_MAX_ROWS = 500;

export const TablePropsSchema = tablePropsSchema();

export type TableProps = z.infer<typeof TablePropsSchema>;

/** Rows still being written are dropped rather than drawn short. */
export const settleTable = (loose: unknown, complete: boolean): unknown => {
  if (complete || typeof loose !== "object" || loose === null) return loose;
  const { columns, rows } = loose as { columns?: unknown; rows?: unknown };
  // No rows yet, or rows bound to data (bindings.ts) that hasn't been
  // resolved: not a table of none, which is what "0 rows" would say.
  if (!Array.isArray(rows)) return loose;
  const width = Array.isArray(columns) ? columns.length : 0;
  return { ...loose, rows: rows.filter((row) => Array.isArray(row) && row.length >= width) };
};

// ---------------------------------------------------------------------------
// Numbers
// ---------------------------------------------------------------------------

export const MetricSchema = z.object({
  label: z.string().max(60),
  value: z.union([z.number(), z.string()]),
  format: FormatSchema.optional(),
  currency: CurrencySchema.optional(),
  delta: z
    .number()
    .optional()
    .describe("Change as a percentage, e.g. 8 for +8%. Only from the data, never estimated."),
  deltaLabel: z
    .string()
    .max(40)
    .optional()
    .describe('What the change is against, e.g. "vs last week".'),
  tone: ToneSchema.optional().describe(
    "Whether the change is good. Defaults to positive for a rise and negative for a fall.",
  ),
});

export type Metric = z.infer<typeof MetricSchema>;

export const KeyValueItemSchema = z.object({
  label: z.string().max(60),
  value: CellSchema,
  format: FormatSchema.optional(),
  currency: CurrencySchema.optional(),
});

export type KeyValueItem = z.infer<typeof KeyValueItemSchema>;

// ---------------------------------------------------------------------------
// Charts
// ---------------------------------------------------------------------------

export const CHART_KINDS = ["bar", "line", "area", "pie"] as const;

/**
 * Column-oriented for the same reason tables are row arrays: one label list
 * and one array of numbers per series, rather than an object per point that
 * spells every series name again.
 */
export const ChartPropsSchema = z.object({
  kind: z
    .enum(CHART_KINDS)
    .describe("bar to compare, line or area for change over time, pie for parts of a whole."),
  categories: z
    .array(z.string().max(40))
    .min(1)
    .max(60)
    .describe("The x-axis labels in order, or the slices of a pie."),
  series: z
    .array(
      z.object({
        label: z.string().max(40),
        values: z
          .array(z.number().nullable())
          .describe("One value per category, in the same order. null where there is none."),
      }),
    )
    .min(1)
    .max(5)
    .describe("Up to five series. A pie uses only the first."),
  format: FormatSchema.optional(),
  currency: CurrencySchema.optional(),
  stacked: z
    .boolean()
    .optional()
    .describe("Stack bar or area series instead of drawing them side by side."),
});

export type ChartProps = z.infer<typeof ChartPropsSchema>;

/**
 * A chart can draw once it has its categories and one whole series. Series
 * still arriving are left out, so a line never plunges to zero where its
 * values haven't been written yet.
 */
export const settleChart = (loose: unknown, complete: boolean): unknown => {
  if (complete || typeof loose !== "object" || loose === null) return loose;
  const { categories, series } = loose as { categories?: unknown; series?: unknown };
  const length = Array.isArray(categories) ? categories.length : 0;
  return {
    ...loose,
    series: Array.isArray(series)
      ? series.filter(
          (entry) =>
            typeof entry === "object" &&
            entry !== null &&
            Array.isArray((entry as { values?: unknown }).values) &&
            (entry as { values: unknown[] }).values.length >= length,
        )
      : [],
  };
};
