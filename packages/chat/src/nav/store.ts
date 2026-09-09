"use client";

import { createContext, type RefObject, use, useSyncExternalStore } from "react";

export type NavState = {
  /** Which groups are open, by value. */
  expanded: ReadonlySet<string>;

  toggle: (value: string) => void;
  setOpen: (value: string, open: boolean) => void;
  setExpanded: (expanded: Iterable<string>) => void;
};

export type NavStore = {
  subscribe: (listener: () => void) => () => void;
  getSnapshot: () => NavState;
  /** Apply server-known state without notifying — the first render must match. */
  hydrate: (state: { expanded?: string[] }) => void;
  controlledRef: RefObject<boolean>;
  onExpandedChangeRef: RefObject<((expanded: string[]) => void) | null>;
  /** Route a change through the controlled/uncontrolled decision and persistence. */
  commitExpanded: (expanded: ReadonlySet<string>) => void;
  /** The Root's element. Keyboard navigation reads row order off the DOM. */
  rootRef: RefObject<HTMLElement | null>;
};

const sameSet = (a: ReadonlySet<string>, b: ReadonlySet<string>) =>
  a.size === b.size && [...a].every((value) => b.has(value));

/**
 * A plain closure store read through `useSyncExternalStore` — not React state
 * and not Zustand. Takes no arguments: everything configurable arrives from
 * `Nav.Root` as props, so a handle created at module scope cannot disagree
 * with the tree that later adopts it.
 */
export const createNavStore = (): NavStore => {
  const listeners = new Set<() => void>();
  const notify = () => {
    for (const listener of listeners) listener();
  };

  const controlledRef: RefObject<boolean> = { current: false };
  const onExpandedChangeRef: RefObject<((expanded: string[]) => void) | null> = { current: null };
  const rootRef: RefObject<HTMLElement | null> = { current: null };

  let snapshot: NavState;

  const commitExpanded = (expanded: ReadonlySet<string>) => {
    if (sameSet(snapshot.expanded, expanded)) return;

    const list = [...expanded];
    onExpandedChangeRef.current?.(list);
    // A controlled Root owns the value: it comes back as a prop or it does not
    // change at all. Writing it here too would let the two disagree.
    if (!controlledRef.current) {
      snapshot = { ...snapshot, expanded };
      notify();
    }
  };

  const setOpen = (value: string, open: boolean) => {
    const next = new Set(snapshot.expanded);
    if (open) next.add(value);
    else next.delete(value);
    commitExpanded(next);
  };

  snapshot = {
    expanded: new Set(),
    toggle: (value) => setOpen(value, !snapshot.expanded.has(value)),
    setOpen,
    setExpanded: (expanded) => commitExpanded(new Set(expanded)),
  };

  return {
    subscribe: (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    getSnapshot: () => snapshot,
    hydrate: ({ expanded }) => {
      if (!expanded) return;
      snapshot = { ...snapshot, expanded: new Set(expanded) };
    },
    controlledRef,
    onExpandedChangeRef,
    commitExpanded,
    rootRef,
  };
};

// ---------------------------------------------------------------------------
// Instance resolution — the nearest Nav.Root, explicitly.
// ---------------------------------------------------------------------------

export const NavStoreContext = createContext<NavStore | null>(null);

/** Internal: parts resolve the store their Nav.Root provided. */
export const useNavContextStore = () => {
  const store = use(NavStoreContext);
  if (!store) throw new Error("Nav parts must be used within <Nav.Root>");
  return store;
};

/** Subscribe to an explicit `Nav.createStore()` handle, from outside the tree. */
export const useNavStore = <Selected = NavState>(
  store: NavStore,
  selector?: (nav: NavState) => Selected,
): Selected => {
  const getValue = () => {
    const state = store.getSnapshot();
    // Safe: without a selector, Selected defaults to NavState.
    return selector ? selector(state) : (state as Selected);
  };
  return useSyncExternalStore(store.subscribe, getValue, getValue);
};

/**
 * Subscribe from inside the tree. Select a primitive — a boolean, an id — so
 * the subscription can settle; a selector building a fresh Set on every call
 * never will.
 */
export const useNav = <Selected = NavState>(selector?: (nav: NavState) => Selected) =>
  useNavStore(useNavContextStore(), selector);
