import { z } from "zod";
import { type BoundData, bindingRefs, hasBinding, withData } from "./bindings";
import { type Catalog, defaultCatalog, isViewName, type Limits } from "./catalog";
import { exportSpec, exportView, resolveSpec } from "./export";
import type { FormatOptions } from "./format";
import {
  type CanonicalView,
  canonicalSpec,
  canonicalView,
  normaliseView,
  readSpec,
  type Spec,
  specSchemas,
} from "./spec";
import type { UiState } from "./state";

/**
 * A generative-UI tool, as every host needs one, with no SDK in it.
 *
 * The host owns its tool definition and wraps this for whichever SDK it uses:
 * the description, the input schema the model is SHOWN, an example, and what
 * to do with a call. The schema is shown but not enforced by the SDK: `accept`
 * validates, so a refusal names the field and goes back to the model as the
 * tool's answer, rather than failing inside the SDK where the model never
 * sees why.
 */

export type GenUiToolKind = "spec" | "view";

export type GenUiToolOptions = {
  /**
   * The name the host registers the tool under. Required: it is how the
   * tool's calls are found in a message (`tool-<name>` parts), for
   * `compactHistory`, `partToMarkdown` and copying.
   */
  name: string;
  /** A layout composed from elements, or one view picked and filled. */
  kind: GenUiToolKind;
  /** For a view tool: the views it offers, in order. Every view in the catalog when omitted. */
  views?: readonly string[];
  /** Whole inputs to show the model. One built from the catalog's examples when omitted. */
  examples?: readonly unknown[];
  /** Limits for this tool's specs, over the catalog's own. */
  limits?: Partial<Limits>;
};

export type GenUiAcceptResult =
  | { ok: true; spec: Spec; summary: string }
  | { ok: true; view: CanonicalView; summary: string }
  | { ok: false; errors: string[] };

export type GenUiMarkdownOptions = FormatOptions & { data?: BoundData; state?: UiState };

export type GenUiTool = {
  name: string;
  kind: GenUiToolKind;
  /** What the model is told about the tool: when to use it, and the rules a call keeps. */
  description: string;
  /** The JSON schema the model is shown: always an object at the top, as providers require. */
  inputSchema: Record<string, unknown>;
  /** Whole, valid inputs, for a host that shows the model examples. */
  examples: readonly unknown[];
  /**
   * A call's input as what to store, or the errors to send back. `data`
   * resolves bound rows for the summary; the stored spec keeps its bindings.
   */
  accept(input: unknown, options?: { data?: BoundData }): GenUiAcceptResult;
  /** What the model is told after a call: what it showed, or what to fix. */
  modelText(result: GenUiAcceptResult): string;
  /** One line for a model's history: what an input shows. */
  summarise(input: unknown, options?: { data?: BoundData }): string;
  /** An input as Markdown, at a UI state. Empty when nothing in it can be read. */
  toMarkdown(input: unknown, options?: GenUiMarkdownOptions): string;
};

/** A summary is a line, not a report. */
const MAX_SUMMARY = 300;

const truncate = (text: string, max = MAX_SUMMARY) =>
  text.length > max ? `${text.slice(0, max - 1).trimEnd()}…` : text;

type Parseable = { safeParse: (value: unknown) => { success: boolean; data?: unknown } };

// ---------------------------------------------------------------------------
// What the model is told
// ---------------------------------------------------------------------------

// Only a call gets the schema, acceptance and a refusal it can fix, so UI is
// never written into a reply, fenced or not.
const RULES = [
  "Every value comes from the conversation or a tool result. Never invent, estimate or calculate one.",
  "The user sees it as soon as it is accepted, so don't repeat it in your reply: add only what it doesn't show.",
  "Show UI only by calling this tool. Never write its input, or any UI as JSON, into your reply.",
];

const BINDING_RULE =
  "To show a tool result's rows, bind them with \"$data\" and the result's ref instead of copying them.";

const isBindable = (catalog: Catalog, kind: GenUiToolKind, views: readonly string[]) =>
  kind === "spec"
    ? Object.values(catalog.elements).some((entry) => entry.input)
    : views.some((name) => catalog.views[name]?.input);

const describe = (catalog: Catalog, kind: GenUiToolKind, views: readonly string[]) => {
  const lead =
    kind === "spec"
      ? "Shows the answer as UI composed from the elements in the schema. Use it when the answer is numbers to compare, rows to read or a plan to follow, not for a sentence or two. Write the elements as a list, parents before their children, each with its own id."
      : `Shows one ready-made view, filled with its props. Use it when one of these fits the answer:\n${views
          .map((name) => `- ${name}: ${catalog.views[name]?.description ?? ""}`)
          .join("\n")}`;
  const rules = isBindable(catalog, kind, views)
    ? [RULES[0], BINDING_RULE, ...RULES.slice(1)]
    : RULES;
  return `${lead}\n\n${rules.map((rule) => `- ${rule}`).join("\n")}`;
};

/** The view tool's input: one object, `view` before `props`, as providers want at the top. */
const viewInputSchema = (catalog: Catalog, views: readonly string[]) => {
  const arms = views.map((name) => {
    const entry = catalog.views[name];
    return (entry?.input ?? entry?.props ?? z.object({})).describe(
      `The props of the ${name} view.`,
    );
  });
  return z.object({
    view: z
      .enum(views as [string, ...string[]])
      .describe("Which view to show. Its props follow it."),
    title: z.string().max(120).optional().describe("A short caption, when the view needs one."),
    props: (arms.length === 1
      ? arms[0]
      : z.union(arms as [z.ZodType, ...z.ZodType[]])) as z.ZodType,
  });
};

/** One whole input from the catalog's own examples: a container holding a few data pieces. */
const exampleSpec = (catalog: Catalog) => {
  const entries = Object.entries(catalog.elements);
  const container = catalog.elements.Card?.container
    ? "Card"
    : entries.find(([, e]) => e.container)?.[0];
  // Pieces that summarise themselves show data, which is what an example should.
  const leaves = entries
    .filter(([, entry]) => !entry.container)
    .sort(([, a], [, b]) => Number(Boolean(b.summarise)) - Number(Boolean(a.summarise)))
    .slice(0, 3);
  const ids = leaves.map(([type], index) => `${type.toLowerCase()}${index + 1}`);
  const pieces = leaves.map(([type, entry], index) => ({
    id: ids[index],
    type,
    props: entry.example,
  }));
  if (!container) return { root: ids[0], elements: pieces.slice(0, 1) };
  return {
    root: "root",
    elements: [
      { id: "root", type: container, props: catalog.elements[container]?.example, children: ids },
      ...pieces,
    ],
  };
};

const exampleView = (catalog: Catalog, views: readonly string[]) => {
  const name = views[0];
  const entry = name ? catalog.views[name] : undefined;
  return entry ? { view: name, title: entry.label, props: entry.example } : undefined;
};

// ---------------------------------------------------------------------------
// Summaries
// ---------------------------------------------------------------------------

const boundLine = (label: string, props: unknown) =>
  `${label} from ${bindingRefs(props).join(", ") || "bound data"}`;

const summariseSpec = (catalog: Catalog, input: unknown, data?: BoundData) => {
  const spec = readSpec(data ? resolveSpec(input, data) : input, catalog);
  if (!spec.root) return "nothing";
  let title: string | undefined;
  const pieces: string[] = [];
  const walk = (id: string, path: string[]) => {
    const element = spec.elements[id];
    const definition = element ? catalog.elements[element.type] : undefined;
    if (!element || !definition || path.includes(id)) return;
    const parsed = (definition.props as Parseable).safeParse(element.props);
    if (parsed.success) {
      title ??=
        definition.names?.scope === "within" ? definition.names.text(parsed.data) : undefined;
      const line = definition.summarise?.(parsed.data);
      if (line) pieces.push(line);
    } else if (hasBinding(element.props)) {
      pieces.push(boundLine(definition.label ?? element.type, element.props));
    }
    for (const child of element.children) walk(child, [...path, id]);
  };
  walk(spec.root, []);
  const body = pieces.join("; ") || "a layout";
  return truncate(title ? `${title}: ${body}` : body);
};

const summariseView = (catalog: Catalog, input: unknown, data?: BoundData) => {
  const normal = normaliseView(input);
  const { view, title, props } = data ? (withData(normal, data) as typeof normal) : normal;
  if (!isViewName(catalog, view)) return "nothing";
  const entry = catalog.views[view];
  if (!entry) return "nothing";
  const caption = typeof title === "string" && title ? title : undefined;
  const parsed = (entry.props as Parseable).safeParse(props);
  if (parsed.success) return truncate(entry.summarise(parsed.data, caption));
  return truncate(boundLine(caption ?? entry.label, props));
};

// ---------------------------------------------------------------------------
// The tool
// ---------------------------------------------------------------------------

const built = new WeakMap<Catalog, Map<string, GenUiTool>>();

/**
 * A tool for a catalog, built once per catalog and options and kept: the same
 * instance every time, so the definition a host builds from it is stable and
 * a provider's prompt cache holds.
 */
export const genUiTool = (
  catalog: Catalog = defaultCatalog,
  options: GenUiToolOptions,
): GenUiTool => {
  const key = JSON.stringify(options);
  const known = built.get(catalog)?.get(key);
  if (known) return known;

  const { name, kind, limits } = options;
  const views = (options.views ?? Object.keys(catalog.views)).filter((view) =>
    isViewName(catalog, view),
  );
  if (kind === "view" && views.length === 0) {
    throw new Error("genui: a view tool needs at least one view the catalog has.");
  }

  const summarise: GenUiTool["summarise"] = (input, { data } = {}) =>
    kind === "spec" ? summariseSpec(catalog, input, data) : summariseView(catalog, input, data);

  const accept: GenUiTool["accept"] = (input, { data } = {}) => {
    if (kind === "spec") {
      const result = canonicalSpec(input, { catalog, limits });
      return result.ok
        ? { ok: true, spec: result.spec, summary: summarise(result.spec, { data }) }
        : result;
    }
    const result = canonicalView(input, { catalog });
    if (!result.ok) return result;
    if (!views.includes(result.view.view)) {
      return {
        ok: false,
        errors: [`view: "${result.view.view}" is not offered here. Views: ${views.join(", ")}.`],
      };
    }
    return { ok: true, view: result.view, summary: summarise(result.view, { data }) };
  };

  const tool: GenUiTool = {
    name,
    kind,
    description: describe(catalog, kind, views),
    inputSchema: (kind === "spec"
      ? specSchemas(catalog).SpecInputSchema
      : viewInputSchema(catalog, views)
    ).toJSONSchema() as Record<string, unknown>,
    examples: options.examples ?? [
      kind === "spec" ? exampleSpec(catalog) : exampleView(catalog, views),
    ],
    accept,
    modelText: (result) =>
      result.ok
        ? `Shown to the user: ${result.summary}. It is on screen now, so don't repeat it in your reply.`
        : `Nothing was shown. Fix these and call again:\n${result.errors.map((error) => `- ${error}`).join("\n")}`,
    summarise,
    toMarkdown: (input, markdown = {}) =>
      (kind === "spec"
        ? exportSpec(input, { catalog, ...markdown })
        : exportView(input, { catalog, ...markdown })
      )?.markdown ?? "",
  };

  const cache = built.get(catalog) ?? new Map<string, GenUiTool>();
  cache.set(key, tool);
  built.set(catalog, cache);
  return tool;
};

// ---------------------------------------------------------------------------
// Messages
// ---------------------------------------------------------------------------

/** The part of a message this reads: structural, so an AI SDK message fits as it is. */
type PartLike = { type: string; text?: unknown; input?: unknown; state?: unknown };

const toolOf = (tools: readonly GenUiTool[], part: PartLike) =>
  tools.find((tool) => part.type === `tool-${tool.name}`);

/**
 * Messages with their earlier large UI inputs replaced by a summary, for
 * sending history back to the model.
 *
 * A layout bound to nothing can carry hundreds of rows, and every turn after
 * it would pay for them again. The model keeps what it needs — what was shown
 * — in `{ "$compacted": summary }`, and the call's result still says it was
 * shown. The last `keep` messages stay whole: by default the user's new
 * message and the reply it answers, whose UI they may be asking about.
 * Nothing is mutated; a message with nothing to compact is returned as it is.
 */
export const compactHistory = <Message extends { parts: readonly PartLike[] }>(
  messages: readonly Message[],
  {
    tools,
    minChars = 4000,
    keep = 2,
  }: { tools: readonly GenUiTool[]; minChars?: number; keep?: number },
): Message[] =>
  messages.map((message, index) => {
    if (index >= messages.length - keep) return message;
    let changed = false;
    const parts = message.parts.map((part) => {
      const tool = toolOf(tools, part);
      if (!tool || part.input === undefined) return part;
      if (JSON.stringify(part.input).length < minChars) return part;
      changed = true;
      return { ...part, input: { $compacted: tool.summarise(part.input) } };
    });
    return changed ? { ...message, parts } : message;
  });

/**
 * One message part as Markdown: a text part as written, a call to one of the
 * tools as its UI at the reader's state, anything else empty. A message's
 * copy action joins its parts with `blocks`, so copying a message never loses
 * a UI in it.
 */
export const partToMarkdown = (
  part: PartLike,
  { tools, ...markdown }: GenUiMarkdownOptions & { tools: readonly GenUiTool[] },
): string => {
  if (part.type === "text") return typeof part.text === "string" ? part.text : "";
  const tool = toolOf(tools, part);
  if (!tool || part.input === undefined || part.state === "input-streaming") return "";
  return tool.toMarkdown(part.input, markdown);
};
