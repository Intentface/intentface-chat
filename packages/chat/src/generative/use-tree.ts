"use client";

import { useMemo, useState } from "react";
import type { AnyCatalog, TreeNode } from "./catalog";
import { type ReadTreeOptions, readTree, type TreeRead } from "./tree";

export type UseTreeOptions = ReadTreeOptions & {
  /** The input is still being written, so nodes keep their last valid props. */
  streaming?: boolean;
};

/** A node's last valid props, and the type they were valid for. */
type Held = { type: string; props: unknown };

const NOTHING_HELD: ReadonlyMap<string, Held> = new Map();

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && Object.getPrototypeOf(value) === Object.prototype;

/** Equal as data, so recomputed props that read the same don't count as new. */
const isEqual = (a: unknown, b: unknown): boolean => {
  if (Object.is(a, b)) return true;
  if (a instanceof Date && b instanceof Date) return a.getTime() === b.getTime();
  if (Array.isArray(a) && Array.isArray(b)) {
    return a.length === b.length && a.every((item, index) => isEqual(item, b[index]));
  }
  if (isPlainObject(a) && isPlainObject(b)) {
    const keys = Object.keys(a);
    return keys.length === Object.keys(b).length && keys.every((key) => isEqual(a[key], b[key]));
  }
  return false;
};

const sameHeld = (a: ReadonlyMap<string, Held>, b: ReadonlyMap<string, Held>) =>
  a.size === b.size &&
  [...a].every(([id, entry]) => {
    const other = b.get(id);
    return other?.type === entry.type && isEqual(entry.props, other.props);
  });

/**
 * The tree with a pending node's held props back in place, and what to hold
 * next. Props are kept only for the type they were valid for: while a type is
 * still being written it can read as a shorter one (`Card` on the way to
 * `CardGrid`).
 */
const holdProps = <C extends AnyCatalog>(root: TreeNode<C>, held: ReadonlyMap<string, Held>) => {
  const next = new Map<string, Held>();
  const visit = (node: TreeNode<C>): TreeNode<C> => {
    const entry = held.get(node.id);
    const kept = node.status === "pending" && entry?.type === node.type ? entry : undefined;
    if (node.status === "ready") next.set(node.id, { type: node.type, props: node.props });
    else if (kept) next.set(node.id, kept);
    return {
      ...node,
      ...(kept ? { status: "ready", props: kept.props } : {}),
      children: node.children.map(visit),
    } as TreeNode<C>;
  };
  return { root: visit(root), next };
};

/**
 * `readTree` in a component: the call's input as nodes to draw. While
 * `streaming`, a node that was ready keeps its last valid props until newer
 * ones validate, so a value caught mid-word doesn't blink back to pending.
 */
export const useTree = <C extends AnyCatalog>(
  input: unknown,
  catalog: C,
  options: UseTreeOptions = {},
): TreeRead<C> => {
  const { resolve, streaming = false } = options;
  const read = useMemo(() => readTree(input, catalog, { resolve }), [input, catalog, resolve]);
  const [held, setHeld] = useState(NOTHING_HELD);
  const holding = streaming && read.root ? holdProps(read.root, held) : undefined;
  const next = holding?.next ?? NOTHING_HELD;
  // Kept from earlier renders the way React documents: set during render, guarded.
  if (!sameHeld(next, held)) setHeld(next);
  return holding ? { root: holding.root } : read;
};
