import { type Catalog, defaultCatalog, type ElementMap, type ViewMap } from "./catalog";
import type { Phase } from "./define";

/**
 * Every piece of a catalog in every state worth drawing, as inputs: for a
 * test, a story, or the conformance checks (`@intentface/chat/genui-testing`).
 *
 * The states come from the entries themselves — the `example`, each of the
 * entry's `fixtures`, and `streaming`: the example cut short and drawn while
 * it streams, as a component sees it mid-answer. A custom entry gets the
 * same treatment by declaring its own.
 */
export type Fixture = {
  /** The piece and its state, e.g. "DataTable (empty)". */
  name: string;
  kind: "element" | "view";
  /** The element's type or the view's name. */
  type: string;
  /** "example", "streaming", or one of the entry's own fixture names. */
  state: string;
  /** The phase to draw it in: `streaming` for a cut-short input, else `accepted`. */
  phase: Phase;
  /** What to draw: a spec for an element, a view's input for a view. */
  input: unknown;
};

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

type Parseable = { safeParse: (value: unknown) => { success: boolean } };

/** The example as it looks mid-stream: each list cut to its first half. */
const cutShort = (props: unknown) => {
  if (!isObject(props)) return undefined;
  let cut = false;
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(props)) {
    if (Array.isArray(value) && value.length > 1) {
      out[key] = value.slice(0, Math.ceil(value.length / 2));
      cut = true;
    } else out[key] = value;
  }
  return cut ? out : undefined;
};

const states = (
  entry: ElementMap[string] | ViewMap[string],
): [state: string, props: unknown, phase: Phase][] => {
  const out: [string, unknown, Phase][] = [["example", entry.example, "accepted"]];
  for (const [state, props] of Object.entries(entry.fixtures ?? {})) {
    out.push([state, props, "accepted"]);
  }
  const short = cutShort(entry.example);
  const settled = short && entry.settle ? entry.settle(short, false) : short;
  if (short && (entry.props as Parseable).safeParse(settled).success) {
    out.push(["streaming", short, "streaming"]);
  }
  return out;
};

export const fixtures = (catalog: Catalog = defaultCatalog): Fixture[] => {
  const out: Fixture[] = [];
  // A container is drawn holding one leaf, so its children have somewhere to go.
  const leaf = Object.entries(catalog.elements).find(([, entry]) => !entry.container);

  for (const [type, entry] of Object.entries(catalog.elements)) {
    for (const [state, props, phase] of states(entry)) {
      const input =
        entry.container && leaf
          ? {
              root: "piece",
              elements: [
                { id: "piece", type, props, children: ["child"] },
                { id: "child", type: leaf[0], props: leaf[1].example },
              ],
            }
          : { root: "piece", elements: [{ id: "piece", type, props }] };
      out.push({ name: `${type} (${state})`, kind: "element", type, state, phase, input });
    }
  }

  for (const [type, entry] of Object.entries(catalog.views)) {
    for (const [state, props, phase] of states(entry)) {
      out.push({
        name: `${type} view (${state})`,
        kind: "view",
        type,
        state,
        phase,
        input: { view: type, title: entry.label, props },
      });
    }
  }
  return out;
};
