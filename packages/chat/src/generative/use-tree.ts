"use client";

import { useMemo, useState } from "react";
import type { AnyCatalog, TreeNode } from "./catalog";
import { type ReadTreeOptions, readTree, type TreeRead } from "./tree";

export type UseTreeOptions = ReadTreeOptions & {
  /** The input is still being written, so nodes keep their last valid props. */
  streaming?: boolean;
};

const NOTHING_HELD: ReadonlyMap<string, unknown> = new Map();

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

const sameHeld = (a: ReadonlyMap<string, unknown>, b: ReadonlyMap<string, unknown>) =>
  a.size === b.size && [...a].every(([id, props]) => b.has(id) && isEqual(props, b.get(id)));

/** Ready props by node id, with a held node's props kept while it's pending again. */
const readyProps = <C extends AnyCatalog>(
  root: TreeNode<C> | undefined,
  held: ReadonlyMap<string, unknown>,
) => {
  const ready = new Map<string, unknown>();
  const visit = (node: TreeNode<C>) => {
    if (node.status === "ready") ready.set(node.id, node.props);
    else if (held.has(node.id)) ready.set(node.id, held.get(node.id));
    node.children.forEach(visit);
  };
  if (root) visit(root);
  return ready;
};

const withHeld = <C extends AnyCatalog>(
  node: TreeNode<C>,
  held: ReadonlyMap<string, unknown>,
): TreeNode<C> =>
  ({
    ...node,
    ...(node.status === "pending" && held.has(node.id)
      ? { status: "ready", props: held.get(node.id) }
      : {}),
    children: node.children.map((child) => withHeld(child, held)),
  }) as TreeNode<C>;

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
  const next = streaming ? readyProps(read.root, held) : NOTHING_HELD;
  // Kept from earlier renders the way React documents: set during render, guarded.
  if (!sameHeld(next, held)) setHeld(next);
  return streaming && read.root ? { root: withHeld(read.root, next) } : read;
};
