import type { z } from "zod";
import type { FormatOptions } from "./format";
import type { Rows } from "./markdown";

/**
 * What a catalog entry is: data and zod, no React.
 *
 * A server validates against it, a renderer draws against it, and Markdown is
 * written from it, so all three hold the same list. The components that draw
 * each entry are the consumer's — the renderer takes them as a map — which is
 * what keeps a catalog free of any one product's look.
 *
 * Two kinds, the two tiers of generative UI:
 *
 * - An ELEMENT is a primitive the model composes into a layout of its own: a
 *   card, a grid, a metric. A spec is a tree of them.
 * - A VIEW is a precomposed piece with one job — a table, an email draft — that
 *   the model picks and fills. Its layout is fixed; only its props are chosen.
 */

/** What every entry's `toMarkdown` is given besides its props. */
export type MarkdownContext = FormatOptions & {
  /**
   * An element's children, already Markdown, in order. A container decides
   * how they join; a leaf ignores them. Always empty for a view.
   */
  children: string[];
  /** A view's caption, when the model gave one. Never set for an element. */
  title?: string;
};

// Callbacks are written as methods, not arrow-typed properties, on purpose:
// methods are checked bivariantly, so an entry typed against its own props
// still fits a catalog typed against `z.ZodType`. As properties, every entry
// would need a cast to sit in a map.
type Shared<Props extends z.ZodType> = {
  /** What the model is told: WHEN to use it, in a line. */
  description: string;
  /** What is validated and drawn: the props with every value in place. */
  props: Props;
  /**
   * What the model is shown, when it may write more than `props` takes: a
   * table's rows or a chart's data bound by ref (`bindings.ts`), which the
   * consumer resolves into `props` before anything checks them.
   */
  input?: z.ZodType;
  /**
   * Partial props made drawable while they stream. Only entries with long
   * arrays need one, to drop the entry still being written rather than draw
   * it short (`settleTable`).
   */
  settle?(loose: unknown, complete: boolean): unknown;
  /**
   * The entry as plain Markdown. REQUIRED: it is what the UI reads as
   * wherever it can't be drawn — pasted, stored in a document, served to an
   * MCP client, indexed — so an entry without one would vanish from all of
   * those. Values formatted as the reader saw them, with the context's locale
   * and time zone. Text from the model or a source must read literally:
   * escape it (`escapeMarkdown`, `escapeMarkdownInline`, `markdownHeading`),
   * so it can't format, link or break the structure around it.
   */
  toMarkdown(props: z.infer<Props>, context: MarkdownContext): string;
  /** Its data as a spreadsheet, when it has rows: raw values, header first. */
  toRows?(props: z.infer<Props>): Rows;
  /** Realistic props. Tests parse and render every one, and docs show them. */
  example: z.input<Props>;
};

export type ElementDefinition<Props extends z.ZodType = z.ZodType> = Shared<Props> & {
  /** Whether it holds other elements, by id. */
  container: boolean;
  /**
   * What its table is called in an export when nothing names it, numbered:
   * "Table 2". Only read when it has `toRows`; the element's type otherwise.
   */
  label?: string;
  /**
   * How it names the tables an export takes from the spec. A heading names
   * the NEXT table after it; a titled container names the tables WITHIN it
   * that no heading named. "Where the socks went", not "Chart 2".
   */
  names?: { scope: "next" | "within"; text(props: z.infer<Props>): string | undefined };
};

export type ViewDefinition<Props extends z.ZodType = z.ZodType> = Shared<Props> & {
  /** What people call it. Also an exported table's name when it has no title. */
  label: string;
  /** One line for a model's history and for search: what was shown. */
  summarise(props: z.infer<Props>, title?: string): string;
};

/**
 * Identity functions, there for inference: `props` types every callback in
 * the entry, so a `toMarkdown` that reads a prop the schema lacks fails to
 * compile.
 */
export const defineElement = <Props extends z.ZodType>(definition: ElementDefinition<Props>) =>
  definition;

export const defineView = <Props extends z.ZodType>(definition: ViewDefinition<Props>) =>
  definition;
