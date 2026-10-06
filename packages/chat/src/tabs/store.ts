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
 * **Peek is a second, smaller channel.** A tab can be *peeked* — its content
 * shown in a floating surface anchored to it — without being selected. That is
 * the one thing open-ness-as-selection cannot express: a strip whose selection
 * is never `null`, holding a page in the layout, while another tab floats over
 * it. `peek` sits beside `value` rather than replacing it, and the two never
 * name the same tab: selecting the peeked tab is how you open it for real, so
 * it ends the peek.
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

/**
 * Why a close was asked for. Only the gestures the primitive owns ask — a
 * `close()` you call yourself is already a decision, so it never does.
 */
export type TabsCloseReason =
  /** A press on `Tabs.Close`. */
  | "close-button"
  /** Delete or Backspace on a focused tab. */
  | "delete-key";

export type TabsCloseRequestDetails = {
  reason: TabsCloseReason;
  /** Keep the tab open. Call `close()` yourself later, once whatever made you
   *  hesitate — a "discard changes?" prompt — has been answered. */
  cancel: () => void;
  readonly canceled: boolean;
};

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
  /**
   * The tab shown in a peek surface without being selected, or `null`. Never
   * the selected tab, and never a disabled one.
   */
  peek: string | null;

  /** Add a tab (or move it, if already open) and select it. */
  open: (value: string, options?: { at?: number }) => void;
  close: (value: string) => void;
  select: (value: string | null) => void;
  /** Step the selection — what the arrow keys drive. */
  selectRelative: (direction: 1 | -1, options?: { loop?: boolean }) => void;
  move: (value: string, toIndex: number) => void;
  setItems: (items: string[]) => void;
  /** Peek a tab, or pass `null` to end the peek. Ignored for the selected tab. */
  setPeek: (value: string | null) => void;
};

export type TabsStore = {
  subscribe: (listener: () => void) => () => void;
  getSnapshot: () => TabsState;

  // --- Bridges the Root wires up. Not consumer API.
  /** Seed state before the first render commits: no notify, no write-back. */
  hydrate: (state: { items?: string[]; value?: string | null; peek?: string | null }) => void;
  selectOnCloseRef: RefObject<TabsSelectOnClose | undefined>;
  orientationRef: RefObject<"horizontal" | "vertical">;
  valueControlledRef: RefObject<boolean>;
  itemsControlledRef: RefObject<boolean>;
  onValueChangeRef: RefObject<((value: string | null) => void) | null>;
  onItemsChangeRef: RefObject<((items: string[]) => void) | null>;
  peekControlledRef: RefObject<boolean>;
  onPeekChangeRef: RefObject<((peek: string | null) => void) | null>;
  onCloseRequestRef: RefObject<((value: string, details: TabsCloseRequestDetails) => void) | null>;
  /** Commit past the controlled guard — how the owner pushes its decision in. */
  commitValue: (value: string | null) => void;
  commitItems: (items: string[]) => void;
  commitPeek: (peek: string | null) => void;
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
  const peekControlledRef: RefObject<boolean> = { current: false };
  const onPeekChangeRef: RefObject<((peek: string | null) => void) | null> = { current: null };
  const onCloseRequestRef: RefObject<
    ((value: string, details: TabsCloseRequestDetails) => void) | null
  > = { current: null };
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

  /** Whether `peek` may stand: the selected tab and disabled tabs never can. */
  const canPeek = (peek: string, value: string | null, disabled: ReadonlySet<string>) =>
    peek !== value && !disabled.has(peek);

  const commitValue = (value: string | null) => {
    if (snapshot.value === value) return;
    const direction = directionBetween(snapshot.value, value);
    const recent =
      value === null
        ? snapshot.recent
        : [value, ...snapshot.recent.filter((id) => id !== value)].slice(0, RECENT_LIMIT);

    // A selection that lands on the peeked tab ends the peek. `select()` does
    // this for presses; this is the path a controlled `value` takes — a link
    // straight to the tab — which never passes through `select()`.
    const endsPeek = value !== null && snapshot.peek === value;
    snapshot = { ...snapshot, value, direction, recent, peek: endsPeek ? null : snapshot.peek };
    if (endsPeek) onPeekChangeRef.current?.(null);
    notify();
  };

  const commitItems = (items: string[]) => {
    if (sameOrder(snapshot.items, items)) return;
    snapshot = { ...snapshot, items };
    notify();
  };

  const commitPeek = (peek: string | null) => {
    // The same rule `setPeek` applies, for a peek pushed in as a controlled
    // prop. Not a membership check: a trigger outside `Tabs.List` has a value
    // that is never in `items`, and may still be peeked.
    const next = peek !== null && !canPeek(peek, snapshot.value, snapshot.disabled) ? null : peek;
    if (snapshot.peek === next) return;
    snapshot = { ...snapshot, peek: next };
    notify();
  };

  const setPeek = (peek: string | null) => {
    if (peek !== null) {
      // The selected tab is already showing, so there is nothing to peek at;
      // a disabled one cannot be opened, and a peek is a way of opening it.
      if (!canPeek(peek, snapshot.value, snapshot.disabled)) return;
    }
    if (snapshot.peek === peek) return;
    onPeekChangeRef.current?.(peek);
    if (!peekControlledRef.current) commitPeek(peek);
  };

  const select = (value: string | null) => {
    // A disabled tab is still reachable by keyboard — that is the point — but
    // arrowing onto one must not open it.
    if (value !== null && snapshot.disabled.has(value)) return;
    // Selecting the peeked tab is opening it for real — the peek has done its
    // job, and the two channels never name the same tab. Ended first, so a
    // listener never sees the tab in both at once.
    if (value !== null && value === snapshot.peek) setPeek(null);
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

    // A closed tab has nothing left to float.
    if (snapshot.peek === value) setPeek(null);
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

    // A disabled tab cannot be opened, and a peek is a way of opening it — so
    // one that becomes disabled while floating stops floating.
    const endsPeek = disabled && snapshot.peek === value;
    snapshot = { ...snapshot, disabled: next, peek: endsPeek ? null : snapshot.peek };
    if (endsPeek) onPeekChangeRef.current?.(null);
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
    peek: null,
    open,
    close,
    select,
    selectRelative,
    move,
    setItems,
    setPeek,
  };

  return {
    subscribe: (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    getSnapshot: () => snapshot,
    hydrate: ({ items, value, peek }) => {
      const nextItems = items ?? snapshot.items;
      const nextValue = value === undefined ? snapshot.value : value;
      const selected = nextValue !== null && nextItems.includes(nextValue) ? nextValue : null;
      const nextPeek = peek === undefined ? snapshot.peek : peek;
      snapshot = {
        ...snapshot,
        items: nextItems,
        // A restored selection whose tab is gone is not a selection.
        value: selected,
        recent: selected !== null ? [selected] : snapshot.recent,
        // Nor is a peek at the tab that is already showing.
        peek: nextPeek === selected ? null : nextPeek,
      };
    },
    selectOnCloseRef,
    orientationRef,
    valueControlledRef,
    itemsControlledRef,
    onValueChangeRef,
    onItemsChangeRef,
    peekControlledRef,
    onPeekChangeRef,
    onCloseRequestRef,
    commitValue,
    commitItems,
    commitPeek,
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
