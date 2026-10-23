/**
 * List maths for an ordered, mutable collection.
 *
 * Base UI derives collection order from the DOM, walking
 * `compareDocumentPosition`, because its collections are declarative children.
 * Ours are not: the order is an array of ids on the store, so order is *data*
 * and none of that machinery is needed. What is left is arithmetic, which is
 * pure and therefore easy to be sure about.
 */

/**
 * Which item to land on when `removed` leaves the collection.
 *
 * The item that slides into the vacated slot, or the last one if the tail was
 * removed — the same thing an editor does when you close a tab, and the
 * closest thing to "stay where you were".
 */
export const adjacentTo = <Id>(
  items: readonly Id[],
  removed: Id,
  /** Skips anything it rejects, searching outwards from the vacated slot. */
  isEligible: (item: Id) => boolean = () => true,
) => {
  const index = items.indexOf(removed);
  if (index === -1) return null;

  const remaining = items.filter((item) => item !== removed && isEligible(item));
  if (remaining.length === 0) return null;

  // Everything that was after it, then everything before it, nearest first.
  const after = items.slice(index + 1).find((item) => remaining.includes(item));
  if (after !== undefined) return after;

  const before = items
    .slice(0, index)
    .reverse()
    .find((item) => remaining.includes(item));
  return before ?? null;
};

/**
 * Step one place through the collection.
 *
 * From nothing, arrive at whichever end you are heading away from. At an edge,
 * either wrap or stay put.
 */
export const step = <Id>(
  items: readonly Id[],
  from: Id | null,
  direction: 1 | -1,
  { loop = true } = {},
) => {
  const last = items.length - 1;
  if (last < 0) return null;

  const index = from === null ? -1 : items.indexOf(from);
  if (index === -1) return (direction === 1 ? items[0] : items[last]) ?? null;

  const next = index + direction;
  if (next < 0) return (loop ? items[last] : items[0]) ?? null;
  if (next > last) return (loop ? items[0] : items[last]) ?? null;

  return items[next] ?? null;
};

/** Move an item to a new position, clamping the target into range. */
export const moveTo = <Id>(items: readonly Id[], id: Id, toIndex: number) => {
  const from = items.indexOf(id);
  if (from === -1) return items as Id[];

  const without = items.filter((item) => item !== id);
  const target = Math.min(Math.max(toIndex, 0), without.length);

  return [...without.slice(0, target), id, ...without.slice(target)];
};

/** Insert an item, or move it if it is already present. Defaults to the end. */
export const insertAt = <Id>(items: readonly Id[], id: Id, index?: number) => {
  const without = items.filter((item) => item !== id);
  if (index === undefined) return [...without, id];

  const target = Math.min(Math.max(index, 0), without.length);
  return [...without.slice(0, target), id, ...without.slice(target)];
};
