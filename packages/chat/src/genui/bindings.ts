import { z } from "zod";
import { ChartPropsSchema, TablePropsSchema } from "./fields";

type TablePropsShape = typeof TablePropsSchema;

/**
 * Data by reference: a table's rows or a chart's series named by where they
 * come from, instead of copied out of it.
 *
 * Copying is where the tokens, the latency and the mistakes are. A model that
 * read 200 rows and retypes them into a table pays for every cell, and can
 * mistype one with nothing to catch it. Bound, it writes
 * `{ "$data": "<ref>", "columns": ["name", "owner.name", "amount"] }` and the
 * consumer puts the source's own values in.
 *
 * The package only carries the placeholder and swaps values in. What a ref
 * MEANS is the consumer's: a chat resolves it against a tool result in the
 * transcript, a document against a saved query or a file. So the ref is an
 * opaque string here — no schema constrains its format, and nothing in this
 * package parses it.
 *
 * Where it runs: the consumer resolves bindings wherever its data lives and
 * files the values by where each binding sits in the normalised spec
 * (`withData`). The renderer and the Markdown export then read a spec with its
 * values in place, and never resolve anything themselves.
 *
 * A binding only picks; it never computes. Filtering, sorting and totals
 * belong in the query, so the number on screen is always a number the source
 * returned.
 */

/**
 * What the model is told the `$data` value is. Neutral by default; a consumer
 * whose refs have a shape the model can see (a ref line on every tool result,
 * say) says so in its own words through `createDefaultCatalog`.
 */
export const DEFAULT_REF_DESCRIPTION = "Where the data comes from: its ref, exactly as given.";

/**
 * The bindable prop schemas, with the ref described as the consumer chooses.
 * Built per description rather than once, because a zod description is part
 * of the schema the model is sent.
 */
export const bindingSchemas = ({
  refDescription = DEFAULT_REF_DESCRIPTION,
  table = TablePropsSchema,
}: {
  refDescription?: string;
  /** The table props to make bindable — another row cap is another schema. */
  table?: TablePropsShape;
} = {}) => {
  const RefSchema = z.string().describe(refDescription);

  const RowsBindingSchema = z
    .object({
      $data: RefSchema,
      columns: z
        .array(z.string())
        .min(1)
        .max(12)
        .describe("The result's own column names, one per table column, in the same order."),
    })
    .describe("A tool result's rows, by its ref, instead of copying them.");

  const ColumnBindingSchema = z
    .object({
      $data: RefSchema,
      column: z.string().describe("The result's own column name."),
    })
    .describe("One column of a tool result's rows, by its ref, instead of copying it.");

  /** The table's props as the model may write them: rows inline, or bound. */
  const TableInputSchema = table.extend({
    rows: z.union([table.shape.rows, RowsBindingSchema]),
  });

  const SeriesSchema = ChartPropsSchema.shape.series;

  /** The chart's props as the model may write them: categories and values inline, or bound. */
  const ChartInputSchema = ChartPropsSchema.extend({
    categories: z.union([ChartPropsSchema.shape.categories, ColumnBindingSchema]),
    series: z
      .array(
        SeriesSchema.element.extend({
          values: z.union([SeriesSchema.element.shape.values, ColumnBindingSchema]),
        }),
      )
      .min(1)
      .max(5)
      .describe(SeriesSchema.description ?? ""),
  });

  return { RefSchema, RowsBindingSchema, ColumnBindingSchema, TableInputSchema, ChartInputSchema };
};

// ---------------------------------------------------------------------------
// Reading a binding
// ---------------------------------------------------------------------------

export type Binding = { $data: string; column?: unknown; columns?: unknown };

export const isBinding = (value: unknown): value is Binding =>
  !!value &&
  typeof value === "object" &&
  !Array.isArray(value) &&
  typeof (value as { $data?: unknown }).$data === "string";

export const hasBinding = (value: unknown): boolean =>
  isBinding(value) ||
  (Array.isArray(value)
    ? value.some(hasBinding)
    : !!value && typeof value === "object" && Object.values(value).some(hasBinding));

/** Every ref a value binds, in the order written, each once. */
export const bindingRefs = (value: unknown): string[] => {
  const refs = new Set<string>();
  const visit = (item: unknown) => {
    if (isBinding(item)) refs.add(item.$data);
    else if (Array.isArray(item)) item.forEach(visit);
    else if (item && typeof item === "object") Object.values(item).forEach(visit);
  };
  visit(value);
  return [...refs];
};

/**
 * Bound values, filed by where their binding sits in the normalised spec:
 * `props.rows` in a view, `elements.k.props.series.0.values` in a layout.
 */
export type BoundData = Readonly<Record<string, unknown>>;

/**
 * The input with every binding replaced by its values, where `data` has them.
 *
 * Filed by position, not by ref: two bindings that read alike — one column,
 * shown as money in one table and as a code in another — are still two
 * places, and can't take each other's values. A binding with no entry is left
 * as it is, so the caller can tell it apart from an empty result.
 */
export const withData = (value: unknown, data: BoundData, at = ""): unknown => {
  const within = (key: string | number) => (at ? `${at}.${key}` : String(key));
  if (isBinding(value)) return Object.hasOwn(data, at) ? data[at] : value;
  if (Array.isArray(value)) return value.map((item, index) => withData(item, data, within(index)));
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [key, withData(item, data, within(key))]),
    );
  }
  return value;
};
