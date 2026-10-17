import { type Catalog, defaultCatalog } from "./catalog";
import { readSpec } from "./spec";

/**
 * UI state: what the reader has done to a drawn spec or view — the open tab,
 * the ticked items, the sort — kept beside it, never in it. An accepted spec
 * is immutable; its state is a separate, small value the host persists and
 * hands back.
 *
 * One shape for both kinds: `keys` holds the state a spec declares (L1, a
 * later catalog version), `elements` each piece's own (an element by id, a
 * view under `VIEW_STATE_ID`). Only some of it outlives the session:
 * `persistedState` keeps the part worth storing.
 */

export type SortState = { column: string; direction: "asc" | "desc" };

/** One piece's own state. Which fields a piece reads depends on what it is. */
export type ElementUiState = {
  /** The open tab of a set of tabs. Persisted. */
  tab?: string;
  /** Whether a disclosure is open. Persisted. */
  open?: boolean;
  /** The ticked items of a checklist, by key. Persisted, and worth telling the model. */
  checked?: string[];
  /** Session only, like everything below: how a table is sorted. */
  sort?: SortState;
  page?: number;
  search?: string;
  expanded?: string[];
};

export type UiState = {
  /** Declared state, by key. Empty until a catalog version declares state. */
  keys: Record<string, unknown>;
  elements: Record<string, ElementUiState>;
};

/** Where a view's own state sits: a view has no element id. */
export const VIEW_STATE_ID = "$view";

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const strings = (value: unknown) =>
  Array.isArray(value) && value.every((item) => typeof item === "string")
    ? (value as string[])
    : undefined;

/** A search is typed by a person and copied into messages, so it is capped. */
const MAX_SEARCH = 1000;

/** The state of a spec or view nobody has touched. */
export const initialState = (_input?: unknown): UiState => ({ keys: {}, elements: {} });

/** The pieces of an input that can hold state: its elements' ids, or the view. */
const pieceIds = (input: unknown, catalog: Catalog) =>
  isObject(input) && "view" in input
    ? new Set([VIEW_STATE_ID])
    : new Set(Object.keys(readSpec(input, catalog).elements));

const readSlice = (raw: Record<string, unknown>): ElementUiState => {
  const slice: ElementUiState = {};
  if (typeof raw.tab === "string") slice.tab = raw.tab;
  if (typeof raw.open === "boolean") slice.open = raw.open;
  const checked = strings(raw.checked);
  if (checked) slice.checked = checked;
  const sort = raw.sort;
  if (
    isObject(sort) &&
    typeof sort.column === "string" &&
    (sort.direction === "asc" || sort.direction === "desc")
  ) {
    slice.sort = { column: sort.column, direction: sort.direction };
  }
  if (typeof raw.page === "number" && Number.isInteger(raw.page) && raw.page >= 0) {
    slice.page = raw.page;
  }
  if (typeof raw.search === "string") slice.search = raw.search.slice(0, MAX_SEARCH);
  const expanded = strings(raw.expanded);
  if (expanded) slice.expanded = expanded;
  return slice;
};

/**
 * Stored state, read back against the input it belongs to.
 *
 * Never throws and never trusts the stored value's shape: a piece that is no
 * longer in the input is dropped, and so is any field of the wrong type, so
 * state saved against one version of a spec survives an edit to it. Declared
 * keys are dropped until a catalog version declares state.
 */
export const readState = (
  input: unknown,
  stored: unknown,
  options: { catalog?: Catalog } = {},
): UiState => {
  const ids = pieceIds(input, options.catalog ?? defaultCatalog);
  const elements: Record<string, ElementUiState> = {};
  const storedElements = isObject(stored) && isObject(stored.elements) ? stored.elements : {};
  for (const [id, raw] of Object.entries(storedElements)) {
    if (!ids.has(id) || !isObject(raw)) continue;
    const slice = readSlice(raw);
    if (Object.keys(slice).length > 0) elements[id] = slice;
  }
  return { keys: {}, elements };
};

/**
 * The part of a state worth storing: declared keys, open tabs and
 * disclosures, ticked items. Sort, page, search and expanded rows belong to
 * the session that made them.
 */
export const persistedState = (state: UiState): UiState => {
  const elements: Record<string, ElementUiState> = {};
  for (const [id, { tab, open, checked }] of Object.entries(state.elements)) {
    const slice: ElementUiState = {
      ...(tab === undefined ? {} : { tab }),
      ...(open === undefined ? {} : { open }),
      ...(checked === undefined ? {} : { checked }),
    };
    if (Object.keys(slice).length > 0) elements[id] = slice;
  }
  return { keys: state.keys, elements };
};
