// Reading what the model wrote: a whole call checked against the catalog, a
// partial one read as nodes to draw, and its data bindings resolved.

import type { StandardIssue } from "../internal/standard-schema";
import {
  type AnyCatalog,
  type AnyComponent,
  type Binding,
  componentOf,
  type FoundBinding,
  isBinding,
  isObject,
  type JsonObject,
  type Limits,
  limitsOf,
  type ResolvedTree,
  type ResolvedTreeElement,
  type Tree,
  type TreeElement,
  type TreeNode,
} from "./catalog";
import { dropNulls, jsonSchemaOf } from "./json-schema";

/** The id a single-component call gets. */
const SINGLE_ID = "root";

// ---------------------------------------------------------------------------
// Issues
// ---------------------------------------------------------------------------

export type TreeIssueCode =
  | "invalid_input"
  | "missing_id"
  | "duplicate_id"
  | "duplicate_child"
  | "missing_root"
  | "root_not_found"
  | "unknown_type"
  | "unexpected_children"
  | "dangling_child"
  | "shared_child"
  | "cycle"
  | "too_deep"
  | "too_many_nodes"
  | "too_many_children"
  | "invalid_props"
  | "invalid_binding"
  | "unresolved_binding";

/** One problem with a call, in words the model can act on. */
export type TreeIssue = { code: TreeIssueCode; message: string; path: (string | number)[] };

type Result<Value> =
  | { value: Value; issues?: undefined }
  | { value?: undefined; issues: TreeIssue[] };

/** A checked call, or what's wrong with it. */
export type TreeResult<C extends AnyCatalog> = Result<Tree<C>>;

/** A tree with its data in place, or what couldn't be resolved. */
export type ResolvedTreeResult<C extends AnyCatalog> = Result<ResolvedTree<C>>;

const issue = (code: TreeIssueCode, message: string, path: (string | number)[]): TreeIssue => ({
  code,
  message,
  path,
});

/** Issues as text for the model, one per line: where, then what's wrong. */
export const formatIssues = (issues: readonly TreeIssue[], max = 8): string => {
  const lines = issues
    .slice(0, max)
    .map((entry) => `${entry.path.join(".") || "(input)"}: ${entry.message}`);
  if (issues.length > max) lines.push(`…and ${issues.length - max} more.`);
  return lines.join("\n");
};

// ---------------------------------------------------------------------------
// Bindings

const bindingIssues = (value: Binding, path: (string | number)[]): TreeIssue[] => {
  const columnsOk =
    value.columns === undefined ||
    (Array.isArray(value.columns) && value.columns.every((column) => typeof column === "string"));
  const columnOk = value.column === undefined || typeof value.column === "string";
  return columnsOk && columnOk
    ? []
    : [
        issue(
          "invalid_binding",
          "A binding takes columns as a list of names, or one column.",
          path,
        ),
      ];
};

/** A row's value at a column name, which may be a dotted path (`owner.name`). */
const cell = (row: unknown, column: string): unknown => {
  if (!isObject(row)) return null;
  if (column in row) return row[column] ?? null;
  const value = column
    .split(".")
    .reduce<unknown>((current, key) => (isObject(current) ? current[key] : undefined), row);
  return value ?? null;
};

/**
 * What a binding points at, picked: rows of objects become rows of the named
 * `columns` in order, or one `column`'s values. Anything else comes as it is.
 */
const pickColumns = (data: unknown, binding: Binding): unknown => {
  const { columns, column } = binding;
  if (!Array.isArray(data)) return data;
  if (columns) return data.map((row) => columns.map((name) => cell(row, name)));
  if (column) return data.map((row) => cell(row, column));
  return data;
};

/**
 * Props with each binding's data in place and its columns picked, and the
 * bindings `lookup` found nothing for, which stay as they are.
 */
const substitute = (
  props: Record<string, unknown>,
  bindings: readonly FoundBinding[],
  lookup: (binding: FoundBinding) => unknown,
) => {
  const next = { ...props };
  const missing: FoundBinding[] = [];
  for (const binding of bindings) {
    const value = lookup(binding);
    if (value === undefined) missing.push(binding);
    else next[binding.prop] = pickColumns(value, binding);
  }
  return { props: next, missing };
};

/** Every binding in a tree, for the host to resolve. */
export const findBindings = <C extends AnyCatalog>(tree: Tree<C>): FoundBinding[] =>
  Object.entries(tree.elements).flatMap(([id, element]) =>
    Object.entries(element.props as Record<string, unknown>)
      .filter((entry): entry is [string, Binding] => isBinding(entry[1]))
      .map(([prop, binding]) => ({ ...binding, id, prop })),
  );

/**
 * The tree with every binding replaced by its data, each element validated
 * again with the data in place. `resolve` returns what a ref names, such as a
 * tool result's rows, and may fetch it; the binding's columns are picked from
 * it. `undefined` means not found.
 */
export const resolveBindings = async <C extends AnyCatalog>(
  tree: Tree<C>,
  catalog: C,
  resolve: (binding: FoundBinding) => unknown | Promise<unknown>,
): Promise<ResolvedTreeResult<C>> => {
  const issues: TreeIssue[] = [];
  // An unbound element already holds its data; each bound one is replaced below.
  const elements = { ...tree.elements } as Record<string, ResolvedTreeElement<C>>;
  const bound = new Map<string, FoundBinding[]>();
  for (const binding of findBindings(tree)) {
    bound.set(binding.id, [...(bound.get(binding.id) ?? []), binding]);
  }

  // Every element's data looked up at once, then validated in place; read back in order.
  const entries = [...bound];
  const settled = await Promise.all(
    entries.map(async ([id, bindings]) => {
      const element = tree.elements[id];
      const definition = element && componentOf(catalog, element.type);
      if (!element || !definition) return undefined;
      const values = await Promise.all(bindings.map((binding) => resolve(binding)));
      const { props, missing } = substitute(
        element.props as Record<string, unknown>,
        bindings,
        (binding) => values[bindings.indexOf(binding)],
      );
      return { element, missing, result: await definition.props["~standard"].validate(props) };
    }),
  );
  entries.forEach(([id], index) => {
    const entry = settled[index];
    if (!entry) return;
    const path = ["elements", id, "props"];
    for (const binding of entry.missing) {
      const message = `No data for "${binding.$data}".`;
      issues.push(issue("unresolved_binding", message, [...path, binding.prop]));
    }
    // A prop whose data wasn't found is reported above, not again as a schema failure.
    const unresolved = new Set(entry.missing.map((binding) => binding.prop));
    if (entry.result.issues) {
      issues.push(...propIssues(issuesOutside(entry.result.issues, unresolved), path));
    } else elements[id] = { ...entry.element, props: entry.result.value } as ResolvedTreeElement<C>;
  });

  return issues.length > 0 ? { issues } : { value: { root: tree.root, elements } };
};

// ---------------------------------------------------------------------------
// Reading what the model wrote
// ---------------------------------------------------------------------------

type LooseElement = { type: unknown; props: JsonObject; children: unknown };

const ELEMENT_KEYS = new Set(["id", "type", "component", "props", "children"]);

/** Two slips models make, read as meant: `component` for `type`, and props beside `type`. */
const normalizeElement = (raw: JsonObject): LooseElement => {
  const beside = Object.fromEntries(Object.entries(raw).filter(([key]) => !ELEMENT_KEYS.has(key)));
  return {
    type: raw.type ?? raw.component,
    props: { ...beside, ...(isObject(raw.props) ? raw.props : {}) },
    children: raw.children,
  };
};

type ReadInput = {
  root: unknown;
  elements: Map<string, LooseElement>;
  /** Where an element sits in the input, for issue paths. */
  pathOf: (id: string) => (string | number)[];
  issues: TreeIssue[];
};

const inElements = (id: string) => ["elements", id];
// One component on its own is the input itself.
const atTop = () => [];

/** Elements as a list or a map keyed by id, or one component on its own. */
const readInput = (input: unknown): ReadInput => {
  const elements = new Map<string, LooseElement>();
  if (!isObject(input)) {
    const problem = issue("invalid_input", "The input must be an object.", []);
    return { root: undefined, elements, pathOf: inElements, issues: [problem] };
  }
  if (input.elements === undefined && (input.type ?? input.component) !== undefined) {
    elements.set(SINGLE_ID, normalizeElement(input));
    return { root: SINGLE_ID, elements, pathOf: atTop, issues: [] };
  }

  const issues: TreeIssue[] = [];
  if (Array.isArray(input.elements)) {
    input.elements.forEach((raw, index) => {
      if (!isObject(raw) || typeof raw.id !== "string") {
        issues.push(issue("missing_id", 'Each element needs an "id".', ["elements", index]));
      } else if (elements.has(raw.id)) {
        const message = `More than one element has the id "${raw.id}".`;
        issues.push(issue("duplicate_id", message, ["elements", index, "id"]));
      } else elements.set(raw.id, normalizeElement(raw));
    });
  } else if (isObject(input.elements)) {
    for (const [id, raw] of Object.entries(input.elements)) {
      if (isObject(raw)) elements.set(id, normalizeElement(raw));
    }
  }
  return { root: input.root, elements, pathOf: inElements, issues };
};

const childIds = (element: LooseElement): string[] =>
  Array.isArray(element.children)
    ? element.children.filter((child): child is string => typeof child === "string")
    : [];

/**
 * What a schema can't check, element by element: a known type, and children
 * that exist, are listed once, belong to one parent and stay within the limits.
 */
const checkElements = (read: ReadInput, catalog: AnyCatalog, limits: Limits): TreeIssue[] => {
  const issues: TreeIssue[] = [];
  const types = Object.keys(catalog.components);
  const parents = new Map<string, string>();

  if (read.elements.size > limits.nodes) {
    const message = `There are ${read.elements.size} elements; the limit is ${limits.nodes}. Show less at once.`;
    issues.push(issue("too_many_nodes", message, ["elements"]));
  }

  for (const [id, element] of read.elements) {
    const path = read.pathOf(id);
    const definition = componentOf(catalog, element.type);
    if (!definition) {
      const message = `"${String(element.type)}" is not a component. Components: ${types.join(", ")}.`;
      issues.push(issue("unknown_type", message, [...path, "type"]));
    }
    const children = childIds(element);
    if (children.length > 0 && definition && !definition.container) {
      const message = `${String(element.type)} doesn't hold other elements.`;
      issues.push(issue("unexpected_children", message, [...path, "children"]));
    }
    if (children.length > limits.children) {
      const message = `${children.length} children; the limit is ${limits.children}. Group them into more containers.`;
      issues.push(issue("too_many_children", message, [...path, "children"]));
    }
    const listed = new Set<string>();
    for (const child of children) {
      if (listed.has(child)) {
        const message = `"${child}" is listed more than once; list each child once.`;
        issues.push(issue("duplicate_child", message, [...path, "children"]));
        continue;
      }
      listed.add(child);
      if (!read.elements.has(child)) {
        const message = `"${child}" is not one of the elements.`;
        issues.push(issue("dangling_child", message, [...path, "children"]));
        continue;
      }
      const other = parents.get(child);
      if (other && other !== id) {
        const message = `"${child}" is a child of both "${other}" and "${id}"; give each its own element.`;
        issues.push(issue("shared_child", message, [...path, "children"]));
      }
      parents.set(child, id);
    }
  }

  return issues;
};

/**
 * The elements reached depth-first from the root, and the cycles and too-deep
 * nesting met on the way. Each step carries its path, so a cycle is caught
 * where it closes.
 */
const walkFromRoot = (read: ReadInput, root: string, limits: Limits) => {
  // In walk order. Each element is walked once, so a child shared between
  // parents, reported as `shared_child`, can't multiply the work.
  const reached = new Set<string>();
  const issues: TreeIssue[] = [];
  const walk = (id: string, path: string[]) => {
    if (path.includes(id)) {
      const message = `"${id}" contains itself (${[...path, id].join(" → ")}).`;
      issues.push(issue("cycle", message, [...read.pathOf(id), "children"]));
      return;
    }
    if (reached.has(id)) return;
    if (path.length + 1 > limits.depth) {
      const message = `"${id}" is nested ${path.length + 1} deep; the limit is ${limits.depth}. Flatten it.`;
      issues.push(issue("too_deep", message, read.pathOf(id)));
      return;
    }
    const element = read.elements.get(id);
    if (!element) return;
    reached.add(id);
    for (const child of childIds(element)) walk(child, [...path, id]);
  };
  walk(root, []);
  return { reached: [...reached], issues };
};

/** A validator's issues, less those under the given props. */
const issuesOutside = (issues: ReadonlyArray<StandardIssue>, props: ReadonlySet<string>) =>
  issues.filter((entry) => {
    const first = entry.path?.[0];
    return !props.has(String(isObject(first) ? first.key : first));
  });

const propIssues = (issues: ReadonlyArray<StandardIssue>, path: (string | number)[]): TreeIssue[] =>
  issues.map((entry) => ({
    code: "invalid_props" as const,
    message: entry.message,
    path: [
      ...path,
      ...(entry.path ?? []).map((segment) =>
        isObject(segment) ? String(segment.key) : (segment as string | number),
      ),
    ],
  }));

/** An element's props as the model wrote them, with strict-mode nulls dropped, and the bindings in them. */
type BoundProps = { props: JsonObject; bindings: FoundBinding[] };

const readBound = (definition: AnyComponent, raw: JsonObject, id: string): BoundProps => {
  const props = dropNulls(raw, jsonSchemaOf(definition)) as JsonObject;
  const bindings = (definition.bind ?? []).flatMap((prop): FoundBinding[] => {
    const value = props[prop];
    return isBinding(value) ? [{ ...value, id, prop }] : [];
  });
  return { props, bindings };
};

/** Props validated, with bound props left in place for `bindings.resolve`. */
const checkProps = async (
  definition: AnyComponent,
  { props, bindings }: BoundProps,
  path: (string | number)[],
): Promise<{ props: JsonObject; issues: TreeIssue[] }> => {
  const issues = bindings.flatMap((binding) => bindingIssues(binding, [...path, binding.prop]));
  const result = await definition.props["~standard"].validate(props);
  if (!result.issues) return { props: result.value as JsonObject, issues };
  // A bound prop fails until resolved; only its binding's own shape counts now.
  const bound = new Set(bindings.map((binding) => binding.prop));
  return { props, issues: [...issues, ...propIssues(issuesOutside(result.issues, bound), path)] };
};

/**
 * A whole call checked against the catalog: its shape read as meant, its
 * structure and limits checked, and each element's props validated. Issues
 * name the field, so `tree.formatIssues` can send them straight back to the model.
 */
export const validateTree = async <C extends AnyCatalog>(
  input: unknown,
  catalog: C,
): Promise<TreeResult<C>> => {
  const limits = limitsOf(catalog);
  const read = readInput(input);
  if (read.issues.length > 0) return { issues: read.issues };
  const { root } = read;
  if (typeof root !== "string") {
    return { issues: [issue("missing_root", "Name the id of the element at the top.", ["root"])] };
  }
  if (!read.elements.has(root)) {
    const message = `"${root}" is not one of the elements.`;
    return { issues: [issue("root_not_found", message, ["root"])] };
  }

  const walked = walkFromRoot(read, root, limits);
  const issues = [...checkElements(read, catalog, limits), ...walked.issues];
  // Every element's props validated at once; read back in tree order.
  const checked = await Promise.all(
    walked.reached.map((id) => {
      const element = read.elements.get(id) as LooseElement;
      const definition = componentOf(catalog, element.type);
      const path = [...read.pathOf(id), "props"];
      return definition && checkProps(definition, readBound(definition, element.props, id), path);
    }),
  );
  const elements: Record<string, TreeElement<C>> = {};
  walked.reached.forEach((id, index) => {
    const result = checked[index];
    if (!result) return;
    const element = read.elements.get(id) as LooseElement;
    issues.push(...result.issues);
    const children = childIds(element);
    elements[id] = {
      type: element.type,
      props: result.props,
      ...(children.length > 0 ? { children } : {}),
    } as TreeElement<C>;
  });

  return issues.length > 0 ? { issues } : { value: { root, elements } };
};

// ---------------------------------------------------------------------------
// Reading while it streams
// ---------------------------------------------------------------------------

export type ReadTreeOptions = {
  /**
   * Returns what a ref names from data already at hand, such as a tool
   * result's rows among the message's parts; the binding's columns are picked
   * from it. It answers within a render, so `undefined`, or a promise, keeps
   * the node pending.
   */
  resolve?: (binding: FoundBinding) => unknown;
};

/** The root node, once there is one to draw. */
export type TreeRead<C extends AnyCatalog> = { root?: TreeNode<C> };

const isPromise = (value: unknown): value is PromiseLike<unknown> =>
  isObject(value) && typeof value.then === "function";

/** A node's props: ready once they validate and their bindings resolve. */
const readProps = (
  definition: AnyComponent,
  { props, bindings }: BoundProps,
  resolve: ReadTreeOptions["resolve"],
): { status: "ready" | "pending"; props: unknown } => {
  const resolved = substitute(props, bindings, (binding) => {
    const value = resolve?.(binding);
    return isPromise(value) ? undefined : value;
  });
  if (resolved.missing.length > 0) return { status: "pending", props };
  const result = definition.props["~standard"].validate(resolved.props);
  // An async validator can't answer within a render, so its node waits.
  if (isPromise(result) || result.issues) return { status: "pending", props: resolved.props };
  return { status: "ready", props: result.value };
};

/**
 * Partial or whole input as nodes to draw, without throwing. A node whose type
 * isn't known yet is skipped; one whose props don't validate yet, or whose
 * data isn't resolved, is pending.
 */
export const readTree = <C extends AnyCatalog>(
  input: unknown,
  catalog: C,
  options: ReadTreeOptions = {},
): TreeRead<C> => {
  const read = readInput(input);
  // Each element draws once. A cycle, a shared child or a child listed twice
  // stops at the first, so the work stays linear and React never sees a key twice.
  const drawn = new Set<string>();
  const build = (id: string): TreeNode<C> | undefined => {
    const element = read.elements.get(id);
    const definition = element && componentOf(catalog, element.type);
    if (!element || !definition || drawn.has(id)) return undefined;
    drawn.add(id);
    const children = childIds(element).flatMap((child) => build(child) ?? []);
    const props = readProps(definition, readBound(definition, element.props, id), options.resolve);
    return { id, type: element.type, ...props, children } as TreeNode<C>;
  };
  return typeof read.root === "string" ? { root: build(read.root) } : {};
};
