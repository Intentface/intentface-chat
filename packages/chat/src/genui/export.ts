import { type BoundData, bindingRefs, hasBinding, withData } from "./bindings";
import { type Catalog, defaultCatalog, isViewName } from "./catalog";
import type { FormatOptions } from "./format";
import type { Rows } from "./markdown";
import { normaliseSpec, normaliseView, readSpec } from "./spec";
import { type UiState, VIEW_STATE_ID } from "./state";

/**
 * A spec or a view as what can be taken out of it: its Markdown, and each of
 * its tables as rows. Computed from the input alone — see `markdown.ts`.
 */
export type GenUiExport = {
  markdown: string;
  /** Every tabular piece, in reading order: a table, or a chart's data. */
  tables: { name: string; rows: Rows }[];
};

/**
 * An element or view whose data is bound and wasn't resolved: `data` had no
 * values for it, so its props can't be read as its schema says.
 */
export type UnboundPiece = {
  /** The element's id in the spec; undefined for a view. */
  id?: string;
  /** The element's type, or the view's name. */
  type: string;
  props: unknown;
  /** The refs it binds, as written. Opaque here — the consumer knows what they name. */
  refs: string[];
};

export type ExportOptions = FormatOptions & {
  catalog?: Catalog;
  /** Bound values, filed by where each binding sits (`withData`). */
  data?: BoundData;
  /** The reader's UI state: the Markdown follows what they did, a ticked item reads ticked. */
  state?: UiState;
  /**
   * Walk from this element instead of the root: one piece and what it holds,
   * as the renderer's `Fallback` draws a piece it has no component for.
   */
  from?: string;
  /**
   * What a piece with unresolved data reads as. Null (the default) leaves it
   * out, which suits a chat's "copy as text": the reader saw it drawn, and
   * copies what was there.
   *
   * A document must not: an agent reading the Markdown later would take a
   * missing table to mean there is no data, which is a wrong answer rather
   * than an absent one. There, return a line that says the data is elsewhere.
   */
  onUnbound?: (piece: UnboundPiece) => string | null;
};

type Parseable = { safeParse: (value: unknown) => { success: boolean; data?: unknown } };

/**
 * A spec as Markdown and tables, or null when nothing in it can be read.
 *
 * Walked from the root, depth first — the order it reads on screen. A table
 * takes its name from the nearest heading before it, else the titled
 * container it sits in, else its kind and position: "Where the socks went",
 * not "Chart 2", when the layout says so (`ElementDefinition.names`).
 *
 * Takes model input or a canonical spec. Pass only what was accepted: this
 * reads what parses and skips the rest, and is not a check.
 */
export const exportSpec = (input: unknown, options: ExportOptions = {}): GenUiExport | null => {
  const catalog: Catalog = options.catalog ?? defaultCatalog;
  const spec = readSpec(options.data ? resolveSpec(input, options.data) : input, catalog);
  const start = options.from ?? spec.root;
  if (!start || !spec.elements[start]) return null;

  const tables: GenUiExport["tables"] = [];
  let heading: string | undefined;
  const counts = new Map<string, number>();

  const walk = (id: string, path: string[], within?: string): string => {
    const element = spec.elements[id];
    if (!element || path.includes(id)) return "";
    const definition = catalog.elements[element.type];
    if (!definition) return "";
    const parsed = (definition.props as Parseable).safeParse(element.props);
    if (!parsed.success) {
      if (!hasBinding(element.props)) return "";
      const piece = { id, type: element.type, props: element.props };
      return options.onUnbound?.({ ...piece, refs: bindingRefs(element.props) }) ?? "";
    }

    const named = definition.names?.text(parsed.data);
    if (definition.names?.scope === "next") heading = named;
    const scope = definition.names?.scope === "within" && named ? named : within;

    if (definition.toRows) {
      const label = definition.label ?? element.type;
      const count = (counts.get(label) ?? 0) + 1;
      counts.set(label, count);
      tables.push({
        name: heading ?? scope ?? `${label} ${count}`,
        rows: definition.toRows(parsed.data),
      });
      // A heading names the one piece after it, not every piece that follows.
      heading = undefined;
    }

    const children = element.children.map((child) => walk(child, [...path, id], scope));
    return definition.toMarkdown(parsed.data, {
      children: children.filter((child) => child !== ""),
      locale: options.locale,
      timeZone: options.timeZone,
      state: options.state?.elements[id],
    });
  };

  const markdown = walk(start, []);
  return markdown ? { markdown, tables: distinctNames(tables) } : null;
};

/** A view as Markdown and tables, or null when its props can't be read. */
export const exportView = (input: unknown, options: ExportOptions = {}): GenUiExport | null => {
  const catalog: Catalog = options.catalog ?? defaultCatalog;
  const normal = normaliseView(input);
  const { view, title, props } = options.data
    ? (withData(normal, options.data) as typeof normal)
    : normal;
  if (!isViewName(catalog, view)) return null;
  const definition = catalog.views[view];
  if (!definition) return null;
  const caption = typeof title === "string" && title ? title : undefined;

  const parsed = (definition.props as Parseable).safeParse(props);
  if (!parsed.success) {
    if (!hasBinding(props)) return null;
    const markdown = options.onUnbound?.({ type: view, props, refs: bindingRefs(props) });
    return markdown ? { markdown, tables: [] } : null;
  }

  return {
    markdown: definition.toMarkdown(parsed.data, {
      children: [],
      title: caption,
      locale: options.locale,
      timeZone: options.timeZone,
      state: options.state?.elements[VIEW_STATE_ID],
    }),
    tables: definition.toRows
      ? [{ name: caption ?? definition.label, rows: definition.toRows(parsed.data) }]
      : [],
  };
};

/** A spec as plain Markdown; empty when nothing in it can be read. */
export const toMarkdown = (input: unknown, options: ExportOptions = {}) =>
  exportSpec(input, options)?.markdown ?? "";

/** A view as plain Markdown; empty when its props can't be read. */
export const viewToMarkdown = (input: unknown, options: ExportOptions = {}) =>
  exportView(input, options)?.markdown ?? "";

/**
 * The spec with bound values swapped in. They are filed against the
 * normalised, id-keyed form, so that is the form they are swapped into.
 */
export const resolveSpec = (input: unknown, data: BoundData) => {
  const { duplicates: _, ...spec } = normaliseSpec(input);
  return withData(spec, data);
};

/** Two tables under one heading would download as the same file; the second becomes "(2)". */
const distinctNames = (tables: GenUiExport["tables"]) => {
  const seen = new Map<string, number>();
  return tables.map((table) => {
    const count = (seen.get(table.name) ?? 0) + 1;
    seen.set(table.name, count);
    return count === 1 ? table : { ...table, name: `${table.name} (${count})` };
  });
};
