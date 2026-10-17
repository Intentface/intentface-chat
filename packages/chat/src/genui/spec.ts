import { z } from "zod";
import { type Catalog, defaultCatalog, isElementName, isViewName, type Limits } from "./catalog";

/**
 * The spec: a layout the model composes from a catalog's elements.
 *
 * Flat, json-render's shape — `{ root, elements: { id: { type, props,
 * children } } }` — naming the catalog's elements and nothing else.
 * Containers hold children by id; everything else is a leaf.
 *
 * Three forms of one spec, each with a job:
 *
 * - INPUT (`SpecInputSchema`): what the model writes. A list of elements,
 *   each naming its own id. See `specSchemas` for why it isn't the map.
 * - CANONICAL (`SpecSchema`): elements by id, its catalog version as `v`,
 *   bindings still in place. What a consumer STORES — `canonicalSpec` makes it
 *   from model input, `readStoredSpec` reads it back.
 * - RESOLVED (`ResolvedSpecSchema`): the same with every bound value in
 *   place. What is drawn and what Markdown is written from.
 */

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

/** One element in a spec held by id: the loose shape every reader here accepts. */
export type SpecElement = { type: string; props?: unknown; children?: string[] };
export type Spec = { v?: number; root: string; elements: Record<string, SpecElement> };

// ---------------------------------------------------------------------------
// Schemas, built from a catalog
// ---------------------------------------------------------------------------

/**
 * Keys that belong to an element itself rather than to its props, beyond the
 * `type`, `props` and `children` every catalog reads. Each is reserved for a
 * later catalog version (`when`, a condition on UI state) and refused until
 * then, never read as a prop: the props schema would drop it without a word,
 * and an element whose condition went missing would show what was meant to be
 * hidden.
 */
const RESERVED_ELEMENT_KEYS: readonly string[] = ["when"];

const unreadKeys = Object.fromEntries(
  RESERVED_ELEMENT_KEYS.map((key) => [
    key,
    z.never({ error: "not read by this version of the catalog; remove it." }).optional(),
  ]),
);

const hasReservedKey = (element: Record<string, unknown>) =>
  RESERVED_ELEMENT_KEYS.some((key) => element[key] !== undefined);

/** Capped by the catalog's limit, which the model is told through the schema. */
const childrenSchema = (max: number) =>
  z.array(z.string()).max(max).optional().describe("Ids of the elements inside this one, in order.");

const VersionSchema = z
  .number()
  .int()
  .positive()
  .optional()
  .describe("The catalog version the spec was written against.");

const build = (catalog: Catalog) => {
  const ChildrenSchema = childrenSchema(catalog.limits.children);

  /**
   * One arm per element, so the schema says exactly which props go with which
   * type. `id` is optional here and required in `SpecInputSchema`: the model
   * writes it into each element, and inside a spec the map key carries it.
   */
  const arms = Object.entries(catalog.elements).map(([name, definition]) =>
    z
      .object({
        id: z.string().optional(),
        type: z.literal(name),
        props: definition.props,
        ...(definition.container ? { children: ChildrenSchema } : {}),
      })
      .describe(definition.description),
  );
  if (arms.length === 0) throw new Error("genui: a catalog needs at least one element.");
  const tuple = arms as [(typeof arms)[number], ...(typeof arms)[number][]];

  /**
   * An element as read back from storage, refusing the keys a later catalog
   * version reads. Not in `SpecInputSchema`: the model is never offered them.
   */
  const readArms = tuple.map((arm) => arm.extend(unreadKeys)) as unknown as typeof tuple;

  /** An element whose props may still hold bindings, where its entry takes them. */
  const boundArms = readArms.map((arm) =>
    arm.extend({ props: catalog.elements[arm.shape.type.value]?.input ?? arm.shape.props }),
  ) as unknown as typeof tuple;

  const ElementSchema = z.discriminatedUnion("type", readArms);

  /**
   * The spec as stored: elements by id, bindings in place.
   *
   * Never handed to the model as a schema. Tool-schema converters (the AI
   * SDK's among them) force `additionalProperties: false` onto every object,
   * and for a record that is where the value schema lives, so a `z.record`
   * reaches the model as "an object with no properties at all". A model
   * handed exactly that guessed. `SpecInputSchema` is the shape it writes;
   * `canonicalSpec` turns that into this one.
   */
  const SpecSchema = z.object({
    v: VersionSchema,
    root: z.string(),
    elements: z.record(z.string(), z.discriminatedUnion("type", boundArms)),
  });

  /** The spec as drawn: every value in place, nothing left to resolve. */
  const ResolvedSpecSchema = z.object({
    v: VersionSchema,
    root: z.string(),
    elements: z.record(z.string(), ElementSchema),
  });

  /**
   * The spec as the model writes it: a flat LIST of elements, each naming its
   * own id. It has no records, so it survives a tool-schema conversion whole.
   */
  const SpecInputSchema = z.object({
    root: z.string().describe("The id of the outermost element, usually a Card."),
    elements: z
      .array(
        z.discriminatedUnion(
          "type",
          tuple.map((arm) =>
            arm.extend({
              id: z.string().describe("This element's id. Children refer to it."),
              // A table's rows and a chart's data may be bound (bindings.ts).
              props: catalog.elements[arm.shape.type.value]?.input ?? arm.shape.props,
            }),
          ) as unknown as typeof tuple,
        ),
      )
      .describe("Every element, parents before their children."),
  });

  return { ElementSchema, SpecSchema, ResolvedSpecSchema, SpecInputSchema };
};

const built = new WeakMap<Catalog, ReturnType<typeof build>>();

/**
 * A catalog's spec schemas, built once per catalog and kept: the same
 * instances every time, so a tool definition built from them is stable and a
 * provider's prompt cache holds.
 */
export const specSchemas = (catalog: Catalog = defaultCatalog) => {
  const known = built.get(catalog);
  if (known) return known;
  const schemas = build(catalog);
  built.set(catalog, schemas);
  return schemas;
};

// ---------------------------------------------------------------------------
// The rules a schema can't state
// ---------------------------------------------------------------------------

const childrenOf = (element: unknown): string[] => {
  const children = isObject(element) ? element.children : undefined;
  return Array.isArray(children)
    ? children.filter((child): child is string => typeof child === "string")
    : [];
};

/**
 * What a spec must satisfy beyond its schema.
 *
 * The schema proves every element is a real component with real props. It
 * cannot prove the elements form a tree — that a child id exists, that nothing
 * is its own ancestor — and those are exactly the mistakes a model makes in a
 * flat map: json-render's published failures are mostly dangling and orphaned
 * ids. So they are checked here, and reported in words the model can act on,
 * because a report like this goes straight back to it as a tool's answer.
 *
 * An element nothing points at is not an error. It is simply not drawn.
 *
 * Limits come from the catalog, and `limits` overrides them for one check: a
 * document may hold more than a chat answer, a slide less.
 */
export const checkSpec = (
  spec: { root: string; elements: Readonly<Record<string, unknown>> },
  options: { catalog?: Catalog; limits?: Partial<Limits> } = {},
): string[] => {
  const limits = { ...(options.catalog ?? defaultCatalog).limits, ...options.limits };
  const errors: string[] = [];
  const ids = Object.keys(spec.elements);

  if (ids.length > limits.elements) {
    errors.push(
      `The spec has ${ids.length} elements; the limit is ${limits.elements}. Show less at once.`,
    );
  }
  if (!spec.elements[spec.root]) {
    errors.push(`The root "${spec.root}" is not one of the elements.`);
    return errors;
  }

  const parents = new Map<string, string>();
  for (const [id, element] of Object.entries(spec.elements)) {
    const count = childrenOf(element).length;
    if (count > limits.children) {
      errors.push(
        `Element "${id}" lists ${count} children; the limit is ${limits.children}. Group them into more containers.`,
      );
    }
    for (const child of childrenOf(element)) {
      if (!spec.elements[child]) {
        errors.push(`Element "${id}" lists child "${child}", which is not one of the elements.`);
        continue;
      }
      const other = parents.get(child);
      if (other && other !== id) {
        errors.push(
          `Element "${child}" is a child of both "${other}" and "${id}"; give each its own element.`,
        );
      }
      parents.set(child, id);
    }
  }

  // Depth-first from the root, with the path so a cycle is caught where it closes.
  const walk = (id: string, path: string[]) => {
    if (path.includes(id)) {
      errors.push(`Element "${id}" contains itself (${[...path, id].join(" → ")}).`);
      return;
    }
    if (path.length + 1 > limits.depth) {
      errors.push(
        `"${id}" is nested ${path.length + 1} deep; the limit is ${limits.depth}. Flatten the layout.`,
      );
      return;
    }
    const element = spec.elements[id];
    if (!element) return;
    for (const child of childrenOf(element)) walk(child, [...path, id]);
  };
  walk(spec.root, []);

  return [...new Set(errors)];
};

/** zod's issues, one line each, in the model's terms: where, and what was wrong. */
export const describeIssues = (
  issues: readonly { path: PropertyKey[]; message: string }[],
  max = 8,
) => {
  const lines = issues.slice(0, max).map((issue) => {
    const path = issue.path.map(String).join(".");
    return `${path || "(input)"}: ${issue.message}`;
  });
  if (issues.length > max) lines.push(`…and ${issues.length - max} more.`);
  return lines;
};

// ---------------------------------------------------------------------------
// Reading what the model wrote
// ---------------------------------------------------------------------------

/**
 * One element, with the two slips models actually make put right.
 *
 * Both came from a real transcript, one after the other, before the model got
 * the shape right on its fourth try: `component` where the key is `type`
 * (json-render's own examples use it), and props written beside `type` with no
 * `props` object around them. Neither is ambiguous, so both are read as meant
 * rather than refused. A refusal costs a whole retry, and the reader watches
 * the UI vanish and come back while it happens.
 *
 * A reserved element-level key (`when`) is never one of those props: it stays
 * on the element, where the schema can refuse it by name.
 */
const normaliseElement = (raw: Record<string, unknown>) => {
  const { type, component, props, children, id: _id, ...rest } = raw;
  const loose: Record<string, unknown> = {};
  const reserved: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(rest)) {
    (RESERVED_ELEMENT_KEYS.includes(key) ? reserved : loose)[key] = value;
  }
  return {
    type: type ?? component,
    props: { ...loose, ...(isObject(props) ? props : {}) },
    children,
    ...reserved,
  };
};

/**
 * A spec as the model wrote it, normalised: the input a server validates and
 * a renderer draws are the same object, whatever the model's small slips.
 *
 * For MODEL INPUT only. A stored spec is canonical already and is read
 * strictly (`readStoredSpec`): forgiving it would let a slip be saved once
 * and read differently by the next reader.
 */
export const normaliseSpec = (
  input: unknown,
): { root?: unknown; elements: Record<string, unknown>; duplicates: string[] } => {
  const loose = isObject(input) ? input : {};
  const elements: Record<string, unknown> = {};
  const duplicates: string[] = [];

  // The list the model is asked for, each element naming its own id. The
  // first of two with one id wins, and the second is reported.
  if (Array.isArray(loose.elements)) {
    for (const raw of loose.elements) {
      if (!isObject(raw) || typeof raw.id !== "string") continue;
      if (raw.id in elements) duplicates.push(raw.id);
      else elements[raw.id] = normaliseElement(raw);
    }
  } else if (isObject(loose.elements)) {
    // Already keyed by id: a canonical spec, or input from before the list.
    for (const [id, raw] of Object.entries(loose.elements)) {
      elements[id] = isObject(raw) ? normaliseElement(raw) : raw;
    }
  }

  return { ...loose, root: loose.root, elements, duplicates };
};

/** A view's input, normalised the same way: props beside `view` are its props. */
export const normaliseView = (
  input: unknown,
): { view?: unknown; title?: unknown; props: unknown } => {
  const { view, title, props, ...rest } = isObject(input) ? input : {};
  return { view, title, props: isObject(props) ? { ...rest, ...props } : rest };
};

export type SpecResult<S> = { ok: true; spec: S } | { ok: false; errors: string[] };

/**
 * Model input as the canonical spec to store, or the errors to send back.
 *
 * Normalises (`normaliseSpec`), refuses duplicate ids, validates against the
 * catalog with bindings allowed, checks the tree, and stamps the catalog's
 * version. Bindings stay: what a ref resolves to can change, and the stored
 * spec should say where its data comes from, not what it was once.
 */
export const canonicalSpec = (
  input: unknown,
  options: { catalog?: Catalog; limits?: Partial<Limits> } = {},
): SpecResult<Spec> => {
  const catalog: Catalog = options.catalog ?? defaultCatalog;
  const { duplicates, ...normal } = normaliseSpec(input);
  if (duplicates.length > 0) {
    return {
      ok: false,
      errors: duplicates.map((id) => `elements: more than one element has the id "${id}".`),
    };
  }
  return parseSpec({ ...normal, v: catalog.version }, catalog, options.limits);
};

const parseSpec = (
  value: unknown,
  catalog: Catalog,
  limits?: Partial<Limits>,
): SpecResult<Spec> => {
  const parsed = specSchemas(catalog).SpecSchema.safeParse(value);
  if (!parsed.success) return { ok: false, errors: describeIssues(parsed.error.issues) };
  const spec = { ...parsed.data, v: catalog.version } as Spec;
  const errors = checkSpec(spec, { catalog, limits });
  return errors.length > 0 ? { ok: false, errors } : { ok: true, spec };
};

/** A view as stored: which view, its caption, and its props with bindings in place. */
export type CanonicalView = { v: number; view: string; title?: string; props: unknown };

export type ViewResult = { ok: true; view: CanonicalView } | { ok: false; errors: string[] };

/** A view's caption. `null` reads as none: a model leaving it out says so. */
const TitleSchema = z.string().max(120).nullish();

/** Issues found under one key, with the key in front of their paths. */
const under = (key: string, issues: readonly { path: PropertyKey[]; message: string }[]) =>
  issues.map((issue) => ({ ...issue, path: [key, ...issue.path] }));

/**
 * Model input for a view as the canonical view to store, or the errors to
 * send back: the view tier's `canonicalSpec`.
 *
 * Normalises (`normaliseView`: props beside `view` are its props), refuses a
 * view the catalog doesn't have, validates the caption and the props with
 * bindings allowed, and stamps the catalog's version. Errors name the field,
 * so they can go straight back to the model as the tool's answer.
 */
export const canonicalView = (input: unknown, options: { catalog?: Catalog } = {}): ViewResult => {
  const catalog: Catalog = options.catalog ?? defaultCatalog;
  const { view, title, props } = normaliseView(input);
  if (!isViewName(catalog, view)) {
    const names = Object.keys(catalog.views).join(", ");
    return {
      ok: false,
      errors: [
        typeof view === "string"
          ? `view: "${view}" is not one of the views. Views: ${names}.`
          : `view: name one of the views: ${names}.`,
      ],
    };
  }

  const definition = catalog.views[view];
  const caption = TitleSchema.safeParse(title);
  const parsed = (definition?.input ?? definition?.props)?.safeParse(props);
  const errors = [
    ...(caption.success ? [] : describeIssues(under("title", caption.error.issues))),
    ...(parsed && !parsed.success ? describeIssues(under("props", parsed.error.issues)) : []),
  ];
  if (errors.length > 0 || !parsed?.success) return { ok: false, errors };

  return {
    ok: true,
    view: {
      v: catalog.version,
      view,
      ...(caption.data == null ? {} : { title: caption.data }),
      props: parsed.data,
    },
  };
};

// ---------------------------------------------------------------------------
// Specs kept for later
// ---------------------------------------------------------------------------

/**
 * A stored spec brought forward from the catalog version it was written
 * against to the catalog's current one, one migration at a time. A version
 * with no migration changes nothing — the default catalog's v1 has none.
 *
 * A spec from a NEWER catalog than this one is returned as it is: there is no
 * migrating down, and `readStoredSpec` says so rather than guess.
 */
export const migrateSpec = (
  spec: unknown,
  fromVersion: number,
  catalog: Catalog = defaultCatalog,
): unknown => {
  if (fromVersion > catalog.version) return spec;
  let current = spec;
  for (let version = fromVersion; version < catalog.version; version++) {
    const step = catalog.migrations[version];
    if (step) current = step(current);
  }
  return isObject(current) ? { ...current, v: catalog.version } : current;
};

/**
 * A stored spec, read back: migrated to the catalog's version, then validated
 * strictly. A spec with no `v` predates versioning and is read as v1.
 *
 * Strict means no normalising: a stored spec was canonical when it was
 * written, and one that no longer parses has outlived a change to the
 * catalog that needed a migration. It is reported, not repaired by guessing.
 */
export const readStoredSpec = (
  stored: unknown,
  options: { catalog?: Catalog; limits?: Partial<Limits> } = {},
): SpecResult<Spec> => {
  const catalog: Catalog = options.catalog ?? defaultCatalog;
  const version = isObject(stored) && typeof stored.v === "number" ? stored.v : 1;
  if (version > catalog.version) {
    return {
      ok: false,
      errors: [
        `The spec was written against version ${version} of the catalog; this one is version ${catalog.version}.`,
      ],
    };
  }
  return parseSpec(migrateSpec(stored, version, catalog), catalog, options.limits);
};

// ---------------------------------------------------------------------------
// Reading a spec while it streams
// ---------------------------------------------------------------------------

/**
 * One element as far as it has arrived: a known type, props that may still be
 * partial, and the children listed so far.
 */
export type LooseElement = { type: string; props: unknown; children: string[] };
export type LooseSpec = { root?: string; elements: Record<string, LooseElement> };

/**
 * Any input — half-written JSON, a canonical spec — as a spec a renderer can
 * walk.
 *
 * Never throws and never guesses. An element whose type the catalog doesn't
 * know (yet: `"Car"` on its way to `"Card"`) is left out; the renderer draws
 * what is there and nothing it would have to take back. So is one carrying a
 * key only a later catalog version reads: drawn without its condition, it
 * could show what was meant to be hidden.
 */
export const readSpec = (input: unknown, catalog: Catalog = defaultCatalog): LooseSpec => {
  const normal = normaliseSpec(input);
  const elements: Record<string, LooseElement> = {};

  for (const [id, raw] of Object.entries(normal.elements)) {
    if (!isObject(raw) || hasReservedKey(raw)) continue;
    const { type, props, children } = raw;
    if (!isElementName(catalog, type)) continue;
    elements[id] = {
      type,
      props: props ?? {},
      children:
        catalog.elements[type]?.container && Array.isArray(children)
          ? children.filter((child): child is string => typeof child === "string")
          : [],
    };
  }

  return { root: typeof normal.root === "string" ? normal.root : undefined, elements };
};
