"use client";

import type { RefObject } from "react";
import { createContext, use, useSyncExternalStore } from "react";
import { adjacentTo, insertAt, moveTo, step } from "../internal/collection";

/**
 * Tabs store — an open-ended, closable collection with at most one tab open.
 *
 * Two things follow from that sentence and shape everything else:
 *
 * **Open-ness is the selection.** There is no separate `open` flag; `value` is
 * either a tab id or `null`, and `null` means nothing is showing. A strip of
 * page tabs simply never reaches `null`; a dock of chat tabs does, every time
 * you close the last one.
 *
 * **Order is data.** `items` is an ordered array on the store, not something
 * derived from the DOM. That is why reordering needs no support here beyond
 * `move` — drag it with whatever library you like through the `render` prop,
 * and the result is a state change like any other.
 *
 * The instance model matches the shell's: `useTabs` resolves the nearest
 * `Tabs.Root` through context, `useTabsStore(handle, selector)` takes an
 * explicit handle for anywhere else, and there is no global fallback.
 */

/**
 * Where the selection lands when the open tab is closed.
 *
 * Unset means nowhere: closing what was open shows nothing. Handing over is a
 * behaviour, and a primitive should not invent one you did not ask for — you
 * would have no reason to suspect it was configurable.
 */
export type TabsSelectOnClose =
  /** Whatever slides into the vacated slot — an editor's behaviour. */
  | "adjacent"
  /** The tab you were in before this one, falling back to adjacent. */
  | "recent";

/** Which way the selection just moved, for panels that slide rather than fade. */
export type TabsDirection = "left" | "right" | "up" | "down" | "none";

export type TabsState = {
  value: string | null;
  /** Set on every selection change and left alone until the next one. */
  direction: TabsDirection;
  items: string[];
  /** Most recently opened first, and what the `recent` close policy reads. */
  recent: string[];
  /** Whether a viewport is rendered, so a trigger only claims one that exists. */
  hasViewport: boolean;
  /** Ids that cannot be selected. They stay in the arrow-key ring regardless. */
  disabled: ReadonlySet<string>;

  /** Add a tab (or move it, if already open) and select it. */
  open: (value: string, options?: { at?: number }) => void;
  close: (value: string) => void;
  select: (value: string | null) => void;
  /** Step the selection — what the arrow keys drive. */
  selectRelative: (direction: 1 | -1, options?: { loop?: boolean }) => void;
  move: (value: string, toIndex: number) => void;
  setItems: (items: string[]) => void;
};

export type TabsStore = {
  subscribe: (listener: () => void) => () => void;
  getSnapshot: () => TabsState;

  // --- Bridges the Root wires up. Not consumer API.
  /** Seed state before the first render commits: no notify, no write-back. */
  hydrate: (state: { items?: string[]; value?: string | null }) => void;
  selectOnCloseRef: RefObject<TabsSelectOnClose | undefined>;
  orientationRef: RefObject<"horizontal" | "vertical">;
  valueControlledRef: RefObject<boolean>;
  itemsControlledRef: RefObject<boolean>;
  onValueChangeRef: RefObject<((value: string | null) => void) | null>;
  onItemsChangeRef: RefObject<((items: string[]) => void) | null>;
  /** Commit past the controlled guard — how the owner pushes its decision in. */
  commitValue: (value: string | null) => void;
  commitItems: (items: string[]) => void;
  registerViewport: (present: boolean) => void;
  registerDisabled: (value: string, disabled: boolean) => void;
  /**
   * Tab elements by id. Imperative, not reactive: it exists so focus can be
   * moved somewhere sensible *before* a closing tab unmounts, which is the one
   * moment a reactive lookup would already be too late.
   */
  elements: Map<string, HTMLElement>;
  registerElement: (value: string, element: HTMLElement | null) => void;
  /**
   * What a floating surface anchors to, which is not the same element focus
   * goes to. Focus belongs on the tab's button; the popup should line up with
   * the whole visual item, close button included — otherwise it sits short by
   * exactly the width of the ×.
   */
  anchors: Map<string, HTMLElement>;
  registerAnchor: (value: string, element: HTMLElement | null) => void;
  /** Stable per-instance id, assigned by the mounting Tabs.Root from useId. */
  baseId: string;
};

/** Enough history to be useful, bounded so a long session cannot grow it forever. */
const RECENT_LIMIT = 50;

const sameOrder = (a: readonly string[], b: readonly string[]) =>
  a.length === b.length && a.every((item, index) => item === b[index]);

export const createTabsStore = (): TabsStore => {
  const listeners = new Set<() => void>();
  const notify = () => {
    for (const listener of listeners) listener();
  };

  const selectOnCloseRef: RefObject<TabsSelectOnClose | undefined> = { current: undefined };
  const orientationRef: RefObject<"horizontal" | "vertical"> = { current: "horizontal" };
  const valueControlledRef: RefObject<boolean> = { current: false };
  const itemsControlledRef: RefObject<boolean> = { current: false };
  const onValueChangeRef: RefObject<((value: string | null) => void) | null> = { current: null };
  const onItemsChangeRef: RefObject<((items: string[]) => void) | null> = { current: null };
  const elements = new Map<string, HTMLElement>();
  const anchors = new Map<string, HTMLElement>();

  let snapshot: TabsState;

  const anchorFor = (value: string) => anchors.get(value) ?? elements.get(value) ?? null;

  /**
   * Which way the selection moved, measured off the two tabs' own rectangles
   * so a reordered strip still reports the truth.
   *
   * When either element is missing — a tab opened and selected in the same
   * commit has not rendered yet — fall back to list order. Base UI compares
   * the *values* here, which only works when they happen to sort meaningfully;
   * we own the ordered array, so we can just look.
   */
  const directionBetween = (from: string | null, to: string | null): TabsDirection => {
    if (from === null || to === null || from === to) return "none";
    const horizontal = orientationRef.current === "horizontal";

    const fromElement = anchorFor(from);
    const toElement = anchorFor(to);

    if (!fromElement || !toElement) {
      const fromIndex = snapshot.items.indexOf(from);
      const toIndex = snapshot.items.indexOf(to);
      if (fromIndex === -1 || toIndex === -1 || fromIndex === toIndex) return "none";
      const forward = toIndex > fromIndex;
      return horizontal ? (forward ? "right" : "left") : forward ? "down" : "up";
    }

    const fromRect = fromElement.getBoundingClientRect();
    const toRect = toElement.getBoundingClientRect();

    if (horizontal) {
      if (toRect.left === fromRect.left) return "none";
      return toRect.left > fromRect.left ? "right" : "left";
    }
    if (toRect.top === fromRect.top) return "none";
    return toRect.top > fromRect.top ? "down" : "up";
  };

  const commitValue = (value: string | null) => {
    if (snapshot.value === value) return;
    const direction = directionBetween(snapshot.value, value);
    const recent =
      value === null
        ? snapshot.recent
        : [value, ...snapshot.recent.filter((id) => id !== value)].slice(0, RECENT_LIMIT);

    snapshot = { ...snapshot, value, direction, recent };
    notify();
  };

  const commitItems = (items: string[]) => {
    if (sameOrder(snapshot.items, items)) return;
    snapshot = { ...snapshot, items };
    notify();
  };

  const select = (value: string | null) => {
    // A disabled tab is still reachable by keyboard — that is the point — but
    // arrowing onto one must not open it.
    if (value !== null && snapshot.disabled.has(value)) return;
    onValueChangeRef.current?.(value);
    if (!valueControlledRef.current) commitValue(value);
  };

  const setItems = (items: string[]) => {
    onItemsChangeRef.current?.(items);
    if (!itemsControlledRef.current) commitItems(items);
  };

  /** Read against the collection as it stands *before* the close lands. */
  const successorTo = (closed: string) => {
    const policy = selectOnCloseRef.current;
    if (!policy) return null;

    // Handing over to a tab that cannot be opened would leave nothing showing.
    const eligible = (id: string) => !snapshot.disabled.has(id);

    if (policy === "recent") {
      const candidate = snapshot.recent.find(
        (id) => id !== closed && snapshot.items.includes(id) && eligible(id),
      );
      // No history yet — a fresh session, or everything since has been closed.
      if (candidate) return candidate;
    }

    return adjacentTo(snapshot.items, closed, eligible);
  };

  const open = (value: string, options?: { at?: number }) => {
    setItems(insertAt(snapshot.items, value, options?.at));
    select(value);
  };

  const close = (value: string) => {
    const wasOpen = snapshot.value === value;
    // Computed first: once the item is gone there is no neighbour to find.
    const successor = wasOpen ? successorTo(value) : snapshot.value;

    setItems(snapshot.items.filter((item) => item !== value));
    if (wasOpen) select(successor);
  };

  const selectRelative = (direction: 1 | -1, options?: { loop?: boolean }) =>
    select(step(snapshot.items, snapshot.value, direction, options));

  const move = (value: string, toIndex: number) => setItems(moveTo(snapshot.items, value, toIndex));

  const registerDisabled = (value: string, disabled: boolean) => {
    if (snapshot.disabled.has(value) === disabled) return;
    const next = new Set(snapshot.disabled);
    if (disabled) next.add(value);
    else next.delete(value);

    snapshot = { ...snapshot, disabled: next };
    notify();
  };

  const registerViewport = (present: boolean) => {
    if (snapshot.hasViewport === present) return;
    snapshot = { ...snapshot, hasViewport: present };
    notify();
  };

  snapshot = {
    value: null,
    direction: "none",
    items: [],
    recent: [],
    hasViewport: false,
    disabled: new Set(),
    open,
    close,
    select,
    selectRelative,
    move,
    setItems,
  };

  return {
    subscribe: (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    getSnapshot: () => snapshot,
    hydrate: ({ items, value }) => {
      const nextItems = items ?? snapshot.items;
      const nextValue = value === undefined ? snapshot.value : value;
      snapshot = {
        ...snapshot,
        items: nextItems,
        // A restored selection whose tab is gone is not a selection.
        value: nextValue !== null && nextItems.includes(nextValue) ? nextValue : null,
        recent: nextValue !== null && nextItems.includes(nextValue) ? [nextValue] : snapshot.recent,
      };
    },
    selectOnCloseRef,
    orientationRef,
    valueControlledRef,
    itemsControlledRef,
    onValueChangeRef,
    onItemsChangeRef,
    commitValue,
    commitItems,
    registerViewport,
    registerDisabled,
    elements,
    registerElement: (value, element) => {
      if (element) elements.set(value, element);
      else elements.delete(value);
    },
    anchors,
    registerAnchor: (value, element) => {
      if (element) anchors.set(value, element);
      else anchors.delete(value);
    },
    baseId: "",
  };
};

// ---------------------------------------------------------------------------
// Instance resolution — the nearest Tabs.Root, explicitly.
// ---------------------------------------------------------------------------

export const TabsStoreContext = createContext<TabsStore | null>(null);

/** Internal: parts resolve the store their Tabs.Root provided. */
export const useTabsContextStore = () => {
  const store = use(TabsStoreContext);
  if (!store) throw new Error("Tabs parts must be used within <Tabs.Root>");
  return store;
};

/** Subscribe to an explicit `Tabs.createStore()` handle, from outside the tree. */
export const useTabsStore = <Selected = TabsState>(
  store: TabsStore,
  selector?: (tabs: TabsState) => Selected,
): Selected => {
  const getValue = () => {
    const state = store.getSnapshot();
    // Safe: without a selector, Selected defaults to TabsState.
    return selector ? selector(state) : (state as Selected);
  };
  return useSyncExternalStore(store.subscribe, getValue, getValue);
};

/**
 * Subscribe from inside the tree. Select a primitive — a boolean, an id — so
 * the subscription can settle; a selector building a fresh array or object on
 * every call never will.
 */
export const useTabs = <Selected = TabsState>(selector?: (tabs: TabsState) => Selected) =>
  useTabsStore(useTabsContextStore(), selector);
