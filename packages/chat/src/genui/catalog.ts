import { z } from "zod";
import { bindingSchemas, DEFAULT_REF_DESCRIPTION } from "./bindings";
import { defineElement, defineView, type ElementDefinition, type ViewDefinition } from "./define";
import {
  ChartPropsSchema,
  DEFAULT_MAX_ROWS,
  KeyValueItemSchema,
  MetricSchema,
  settleChart,
  settleTable,
  ToneSchema,
  tablePropsSchema,
} from "./fields";
import {
  blocks,
  chartMarkdown,
  chartRows,
  escapeMarkdown,
  escapeMarkdownInline,
  keyValueLines,
  markdownHeading,
  metricLine,
  quote,
  tableMarkdown,
  tableRows,
} from "./markdown";
import {
  chartRender,
  keyValueItems,
  type MetricsRender,
  metricRender,
  type RecordRender,
  type StepsRender,
  tableRender,
} from "./render";

/**
 * A catalog: the elements a model may compose, the views it may fill, and the
 * rules a spec built from them must keep.
 *
 * ── Versioning ──────────────────────────────────────────────────────────────
 * A spec outlives the code that drew it. A chat replays a call for as long as
 * the chat exists; a document keeps a block for years. So an entry never
 * changes incompatibly in place: add `ChartV2` beside `Chart`, or bump
 * `version` and add a migration from the old version to the new one. A stored
 * spec records the version it was written against (`v`), and `readStoredSpec`
 * brings it forward before anything reads it.
 */

export type Limits = {
  /** Most elements one spec may hold. */
  elements: number;
  /** Deepest nesting from the root, the root counting as 1. */
  depth: number;
  /**
   * Most children one container may list. Also part of the schema the model
   * is sent, built from the catalog's limit, so a single check can lower it
   * but only the catalog can raise it.
   */
  children: number;
};

/** Sized for a chat answer: past this, a reply is a report and should be one. */
export const DEFAULT_LIMITS: Limits = { elements: 40, depth: 6, children: 24 };

/** One version's spec as the next version's. Given whatever was stored; returns the same. */
export type Migration = (spec: unknown) => unknown;

export type ElementMap = Readonly<Record<string, ElementDefinition>>;
export type ViewMap = Readonly<Record<string, ViewDefinition>>;

export type Catalog<Elements extends ElementMap = ElementMap, Views extends ViewMap = ViewMap> = {
  /** Bumped whenever an entry changes in a way a stored spec would notice. */
  readonly version: number;
  readonly elements: Elements;
  readonly views: Views;
  readonly limits: Limits;
  /** By the version they migrate FROM: `migrations[1]` turns a v1 spec into v2. */
  readonly migrations: Readonly<Record<number, Migration>>;
};

/**
 * A catalog from its parts, with the defaults filled in.
 *
 * To extend one, spread it: a document app that adds its own elements and
 * holds longer specs writes
 *
 *     defineCatalog({
 *       ...defaultCatalog,
 *       elements: { ...defaultCatalog.elements, Timeline },
 *       limits: { elements: 120 },
 *     })
 *
 * and to narrow one, passes only the entries to keep. An extended catalog's
 * version is its own: keep the base's migrations in `migrations` alongside
 * any of yours, so a spec stored against the base still comes forward.
 */
export const defineCatalog = <
  Elements extends ElementMap,
  // biome-ignore lint/complexity/noBannedTypes: an empty map is the honest default for "no views".
  Views extends ViewMap = {},
>(options: {
  version: number;
  elements: Elements;
  views?: Views;
  limits?: Partial<Limits>;
  migrations?: Readonly<Record<number, Migration>>;
}): Catalog<Elements, Views> => ({
  version: options.version,
  elements: options.elements,
  views: options.views ?? ({} as Views),
  limits: { ...DEFAULT_LIMITS, ...options.limits },
  migrations: options.migrations ?? {},
});

export type ElementName<C extends Catalog> = keyof C["elements"] & string;
export type ViewName<C extends Catalog> = keyof C["views"] & string;
export type ElementProps<C extends Catalog, Name extends ElementName<C>> = z.infer<
  C["elements"][Name]["props"]
>;
export type ViewProps<C extends Catalog, Name extends ViewName<C>> = z.infer<
  C["views"][Name]["props"]
>;
/** What an element's component is drawn with: its `toRender` output, else its schema props. */
export type ElementRender<C extends Catalog, Name extends ElementName<C>> = ReturnType<
  NonNullable<C["elements"][Name]["toRender"]>
>;
/** What a view's component is drawn with: its `toRender` output, else its schema props. */
export type ViewRender<C extends Catalog, Name extends ViewName<C>> = ReturnType<
  NonNullable<C["views"][Name]["toRender"]>
>;

export const isElementName = <C extends Catalog>(
  catalog: C,
  name: unknown,
): name is ElementName<C> => typeof name === "string" && Object.hasOwn(catalog.elements, name);

export const isViewName = <C extends Catalog>(catalog: C, name: unknown): name is ViewName<C> =>
  typeof name === "string" && Object.hasOwn(catalog.views, name);

// ---------------------------------------------------------------------------
// The default catalog
// ---------------------------------------------------------------------------

/** The default catalog's version. 1 until an entry changes shape. */
export const DEFAULT_CATALOG_VERSION = 1;

const caption = (title?: string) => (title ? `**${escapeMarkdownInline(title)}**` : undefined);

const list = (items: readonly string[], max = 4) =>
  items.length <= max
    ? items.join(", ")
    : `${items.slice(0, max).join(", ")} and ${items.length - max} more`;

/**
 * The default catalog, built with the parts a consumer may need to say in
 * its own words or size for its own medium.
 *
 * Descriptions are written for the model and say WHEN to use a thing, since
 * they are the documentation it gets. They are product-neutral; what a ref
 * looks like is the one thing only the consumer knows, so it is the one
 * description it can replace.
 */
export const createDefaultCatalog = ({
  refDescription = DEFAULT_REF_DESCRIPTION,
  maxRows = DEFAULT_MAX_ROWS,
  limits,
}: {
  /** What the model is told the `$data` ref is. See `bindingSchemas`. */
  refDescription?: string;
  /** The most rows a table may hold. Part of the schema the model is sent. */
  maxRows?: number;
  limits?: Partial<Limits>;
} = {}) => {
  const TablePropsSchema = tablePropsSchema(maxRows);
  const { TableInputSchema, ChartInputSchema } = bindingSchemas({
    refDescription,
    table: TablePropsSchema,
  });

  const elements = {
    Card: defineElement({
      description: "Groups one answer under an optional title. The usual root.",
      container: true,
      props: z.object({
        title: z.string().max(120).optional(),
        description: z.string().max(240).optional(),
      }),
      names: { scope: "within", text: (props) => props.title },
      toMarkdown: (props, { children }) =>
        blocks(
          props.title ? markdownHeading(3, props.title) : undefined,
          props.description ? escapeMarkdown(props.description) : undefined,
          ...children,
        ),
      example: { title: "This week" },
      fixtures: { untitled: {}, described: { title: "Q3", description: "Paid orders only." } },
    }),
    Stack: defineElement({
      description: "Lays children out in a column (default) or a row.",
      container: true,
      props: z.object({
        direction: z.enum(["column", "row"]).optional(),
        gap: z.enum(["sm", "md", "lg"]).optional(),
      }),
      toMarkdown: (_, { children }) => blocks(...children),
      example: { direction: "column", gap: "md" },
      fixtures: { row: { direction: "row", gap: "sm" }, bare: {} },
    }),
    Grid: defineElement({
      description:
        "Equal columns that wrap on a narrow screen. For several metrics or small cards.",
      container: true,
      props: z.object({ columns: z.union([z.literal(2), z.literal(3), z.literal(4)]) }),
      // Metrics in a grid are list items; one per line keeps them one list.
      toMarkdown: (_, { children }) =>
        children.every((child) => child.startsWith("- "))
          ? children.join("\n")
          : blocks(...children),
      example: { columns: 3 },
      fixtures: { two: { columns: 2 }, four: { columns: 4 } },
    }),
    Heading: defineElement({
      description: "A section title inside a card.",
      container: false,
      props: z.object({ text: z.string().max(120) }),
      names: { scope: "next", text: (props) => props.text },
      toMarkdown: (props) => markdownHeading(4, props.text),
      example: { text: "Renewals" },
      fixtures: {
        long: { text: "Renewals due before the end of the quarter, by owner and region" },
      },
    }),
    Text: defineElement({
      description: "A sentence or two. Keep longer prose in the reply itself.",
      container: false,
      props: z.object({
        text: z.string().max(1200),
        tone: z.enum(["default", "muted"]).optional(),
      }),
      toMarkdown: (props) => escapeMarkdown(props.text),
      example: { text: "Two deals moved forward; one renewal has no owner." },
      fixtures: {
        long: {
          text: "Renewals slipped in three regions this month. Two accounts have no owner since the reorganisation, and the largest, Northwind, moved its decision to the next quarter after their admin left; usage there has fallen for three weeks in a row.",
        },
        muted: { text: "Figures exclude refunds.", tone: "muted" },
      },
    }),
    Metric: defineElement({
      description:
        "One headline number the answer turns on — a total, a count, a rate — with an optional " +
        "change. Only when the numbers are the point; names, stages and dates go in a KeyValue. " +
        "Several go in a Grid.",
      container: false,
      props: MetricSchema,
      toMarkdown: (props, context) => metricLine(props, context),
      toRender: (props, context) => metricRender(props, context),
      summarise: (props) => `${props.label} ${props.value}`,
      example: {
        label: "Open pipeline",
        value: 240000,
        format: "currency",
        currency: "EUR",
        delta: 8,
      },
      fixtures: {
        falling: {
          label: "Win rate",
          value: 27.5,
          format: "percent",
          delta: -4.2,
          deltaLabel: "vs last month",
        },
        words: { label: "Status", value: "On track" },
        missing: { label: "Last order", value: "", format: "date" },
      },
    }),
    KeyValue: defineElement({
      description: "A few labelled fields of one thing.",
      container: false,
      props: z.object({ items: z.array(KeyValueItemSchema).min(1).max(24) }),
      toMarkdown: (props, context) => keyValueLines(props.items, context),
      toRender: (props, context) => ({ items: keyValueItems(props.items, context) }),
      summarise: (props) =>
        list(
          props.items.map((item) => `${item.label}: ${item.value ?? "—"}`),
          3,
        ),
      example: {
        items: [
          { label: "Owner", value: "Minna Laine" },
          { label: "Renewal", value: "2026-11-30", format: "date" },
        ],
      },
      fixtures: {
        missing: {
          items: [
            { label: "Owner", value: null },
            { label: "Seats", value: 140, format: "number" },
          ],
        },
      },
    }),
    DataTable: defineElement({
      description: "Rows and columns.",
      container: false,
      label: "Table",
      props: TablePropsSchema,
      input: TableInputSchema,
      settle: settleTable,
      toMarkdown: (props, context) => tableMarkdown(props, context),
      toRows: tableRows,
      toRender: (props, context) => tableRender(props, context),
      summarise: (props) =>
        `table of ${props.rows.length} rows (${list(props.columns.map((c) => c.label))})`,
      example: {
        columns: [{ label: "Account" }, { label: "Value", format: "currency", currency: "EUR" }],
        rows: [
          ["Northwind", 42000],
          ["Globex", 18500],
        ],
      },
      fixtures: {
        empty: { columns: [{ label: "Account" }, { label: "Value" }], rows: [] },
        missing: {
          columns: [
            { label: "Account" },
            { label: "Closed", format: "date" },
            { label: "Value", format: "currency", currency: "EUR" },
          ],
          rows: [
            ["Northwind", null, -1200],
            ["Globex", "2026-09-30", null],
          ],
        },
      },
    }),
    Chart: defineElement({
      description: "A bar, line, area or pie chart.",
      container: false,
      label: "Chart",
      props: ChartPropsSchema,
      input: ChartInputSchema,
      settle: settleChart,
      toMarkdown: (props, context) => chartMarkdown(props, context),
      toRows: chartRows,
      toRender: (props, context) => chartRender(props, context),
      summarise: (props) =>
        `${props.kind} chart of ${list(props.series.map((s) => s.label))} over ${props.categories.length} ${props.kind === "pie" ? "slices" : "points"}`,
      example: {
        kind: "line",
        categories: ["W1", "W2", "W3", "W4"],
        series: [{ label: "Pipeline", values: [180, 205, 222, 240] }],
      },
      fixtures: {
        gaps: {
          kind: "bar",
          categories: ["Jan", "Feb", "Mar"],
          series: [
            { label: "New", values: [12, null, 15] },
            { label: "Renewed", values: [8, 9, null] },
          ],
          stacked: true,
        },
        pie: {
          kind: "pie",
          categories: ["Direct", "Partner", "Online"],
          series: [{ label: "Share", values: [52, 30, 18] }],
          format: "percent",
        },
      },
    }),
    Callout: defineElement({
      description: "Something the reader must not miss: a risk, a gap in the data, a success.",
      container: false,
      props: z.object({
        tone: z.enum(["info", "positive", "warning", "negative"]),
        title: z.string().max(120).optional(),
        text: z.string().max(600),
      }),
      toMarkdown: (props) =>
        quote(
          props.title
            ? `**${escapeMarkdownInline(props.title)}** ${escapeMarkdown(props.text)}`
            : escapeMarkdown(props.text),
        ),
      summarise: (props) => `${props.tone}: ${props.title ?? props.text}`.slice(0, 120),
      example: { tone: "warning", title: "No owner", text: "The Globex renewal is due Friday." },
      fixtures: { untitled: { tone: "info", text: "Figures are from Monday's export." } },
    }),
  };

  const views = {
    table: defineView({
      label: "Table",
      description:
        "Rows and columns to read or compare. Use instead of a Markdown table for more than a handful of rows.",
      props: TablePropsSchema,
      input: TableInputSchema,
      settle: settleTable,
      summarise: (props, title) =>
        `${title ?? "Table"}: ${props.rows.length} rows (${list(props.columns.map((c) => c.label))})`,
      toMarkdown: (props, context) => blocks(caption(context.title), tableMarkdown(props, context)),
      toRows: tableRows,
      toRender: (props, context) => tableRender(props, context),
      example: {
        columns: [
          { label: "Account" },
          { label: "Stage" },
          { label: "Value", format: "currency", currency: "EUR" },
        ],
        rows: [
          ["Northwind", "Proposal", 42000],
          ["Globex", "Discovery", 18500],
          ["Initech", "Negotiation", 67000],
        ],
      },
      fixtures: { empty: { columns: [{ label: "Account" }, { label: "Stage" }], rows: [] } },
    }),

    chart: defineView({
      label: "Chart",
      description:
        "Numbers whose shape matters: a trend over time, a comparison across groups, parts of a whole.",
      props: ChartPropsSchema,
      input: ChartInputSchema,
      settle: settleChart,
      summarise: (props, title) =>
        `${title ?? "Chart"}: ${props.kind} chart of ${list(props.series.map((s) => s.label))} over ${props.categories.length} ${props.kind === "pie" ? "slices" : "points"}`,
      toMarkdown: (props, context) => blocks(caption(context.title), chartMarkdown(props, context)),
      toRows: chartRows,
      toRender: (props, context) => chartRender(props, context),
      example: {
        kind: "bar",
        categories: ["Jan", "Feb", "Mar", "Apr", "May", "Jun"],
        series: [
          { label: "New", values: [12, 18, 15, 22, 27, 31] },
          { label: "Renewed", values: [8, 9, 11, 10, 14, 13] },
        ],
        format: "number",
      },
      fixtures: {
        pie: {
          kind: "pie",
          categories: ["Direct", "Partner"],
          series: [{ label: "Share", values: [64, 36] }],
          format: "percent",
        },
      },
    }),

    metrics: defineView({
      label: "Metrics",
      description: "Two to six headline numbers side by side, each with an optional change.",
      props: z.object({ items: z.array(MetricSchema).min(1).max(6) }),
      summarise: (props, title) =>
        `${title ? `${title}: ` : ""}${props.items.map((item) => `${item.label} ${item.value}`).join(", ")}`,
      toMarkdown: (props, context) =>
        blocks(
          caption(context.title),
          props.items.map((item) => metricLine(item, context)).join("\n"),
        ),
      toRender: (props, context): MetricsRender => ({
        items: props.items.map((item) => metricRender(item, context)),
      }),
      example: {
        items: [
          {
            label: "Open pipeline",
            value: 240000,
            format: "currency",
            currency: "EUR",
            delta: 8,
            deltaLabel: "vs last week",
          },
          { label: "Deals", value: 12, format: "number", delta: -2 },
          { label: "Win rate", value: 31, format: "percent" },
        ],
      },
      fixtures: { one: { items: [{ label: "Open tickets", value: 0, delta: -100 }] } },
    }),

    record: defineView({
      label: "Record",
      description:
        "One thing — a customer, a deal, a ticket, a person — with its key fields and status.",
      props: z.object({
        name: z.string().max(120),
        subtitle: z.string().max(160).optional(),
        status: z.object({ label: z.string().max(40), tone: ToneSchema.optional() }).optional(),
        fields: z.array(KeyValueItemSchema).max(24),
        note: z.string().max(600).optional().describe("A sentence or two worth knowing about it."),
      }),
      summarise: (props) =>
        `Record: ${props.name}${props.status ? ` (${props.status.label})` : ""} — ${list(props.fields.map((f) => f.label))}`,
      toMarkdown: (props, context) =>
        blocks(
          markdownHeading(3, props.name),
          props.subtitle ? escapeMarkdownInline(props.subtitle) : undefined,
          props.status ? `Status: ${escapeMarkdownInline(props.status.label)}` : undefined,
          keyValueLines(props.fields, context),
          props.note ? escapeMarkdown(props.note) : undefined,
        ),
      toRender: (props, context): RecordRender => ({
        name: props.name,
        ...(props.subtitle ? { subtitle: props.subtitle } : {}),
        ...(props.status
          ? { status: { label: props.status.label, tone: props.status.tone ?? "neutral" } }
          : {}),
        fields: keyValueItems(props.fields, context),
        ...(props.note ? { note: props.note } : {}),
      }),
      example: {
        name: "Northwind Traders",
        subtitle: "Wholesale · Helsinki",
        status: { label: "At risk", tone: "warning" },
        fields: [
          { label: "Owner", value: "Minna Laine" },
          { label: "ARR", value: 86000, format: "currency", currency: "EUR" },
          { label: "Renewal", value: "2026-11-30", format: "date" },
          { label: "Seats", value: 140, format: "number" },
        ],
        note: "Usage has fallen for three weeks since their admin left.",
      },
      fixtures: { bare: { name: "Globex", fields: [] } },
    }),

    email: defineView({
      label: "Email draft",
      description:
        "An email written for the user to send: recipients, subject and body, ready to copy or open in their mail app.",
      props: z.object({
        to: z.array(z.string().max(200)).max(20).describe("Addresses or names."),
        cc: z.array(z.string().max(200)).max(20).optional(),
        subject: z.string().max(200),
        body: z.string().max(10_000).describe("Plain text. Blank lines between paragraphs."),
      }),
      summarise: (props) =>
        `Email draft to ${list(props.to, 3) || "no one yet"}: "${props.subject}"`,
      // Plain text rather than Markdown, and deliberately not escaped: this is
      // pasted into a mail client, where a backslash before every asterisk
      // would arrive as written. It is still valid Markdown.
      toMarkdown: (props) =>
        blocks(
          [
            `To: ${props.to.join(", ")}`,
            props.cc?.length ? `Cc: ${props.cc.join(", ")}` : undefined,
            `Subject: ${props.subject}`,
          ]
            .filter(Boolean)
            .join("\n"),
          props.body,
        ),
      example: {
        to: ["jonas@northwind.example"],
        subject: "Your renewal on 30 November",
        body: "Hi Jonas,\n\nYour renewal comes up on 30 November. Could we find half an hour next week to go through the new seat count?\n\nBest,\nMinna",
      },
      fixtures: {
        copied: {
          to: ["jonas@northwind.example", "Aino Virtanen"],
          cc: ["minna@sales.example"],
          subject: "Seat count before the renewal",
          body: "Hi both,\n\nCould you confirm the seat count by Friday?\n\nThanks,\nMinna",
        },
      },
    }),

    steps: defineView({
      label: "Steps",
      description: "An ordered plan or checklist: what to do, in order, and what is already done.",
      props: z.object({
        items: z
          .array(
            z.object({
              title: z.string().max(160),
              detail: z.string().max(400).optional(),
              status: z.enum(["todo", "current", "done"]).optional(),
            }),
          )
          .min(1)
          .max(20),
      }),
      summarise: (props, title) =>
        `${title ?? "Steps"}: ${list(
          props.items.map((item) => item.title),
          3,
        )}`,
      toMarkdown: (props, context) =>
        blocks(
          caption(context.title),
          props.items
            .map(
              (item) =>
                `- [${item.status === "done" ? "x" : " "}] ${escapeMarkdownInline(item.title)}${item.detail ? ` — ${escapeMarkdownInline(item.detail)}` : ""}`,
            )
            .join("\n"),
        ),
      toRender: (props): StepsRender => ({
        items: props.items.map((item, index) => ({
          key: String(index),
          title: item.title,
          ...(item.detail ? { detail: item.detail } : {}),
          status: item.status ?? "todo",
        })),
      }),
      example: {
        items: [
          { title: "Confirm the new seat count", status: "done" },
          {
            title: "Send the renewal quote",
            detail: "Include the two-year option.",
            status: "current",
          },
          { title: "Book the handover with their new admin" },
        ],
      },
      fixtures: {
        done: {
          items: [
            { title: "Export the list", status: "done" },
            { title: "Remove duplicates", status: "done" },
          ],
        },
      },
    }),
  };

  return defineCatalog({ version: DEFAULT_CATALOG_VERSION, elements, views, limits });
};

export type DefaultCatalog = ReturnType<typeof createDefaultCatalog>;

/** The default catalog with the default wording and sizes. */
export const defaultCatalog: DefaultCatalog = createDefaultCatalog();
