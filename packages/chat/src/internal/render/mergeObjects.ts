// Vendored from @base-ui/utils v1.6.0 (MIT) — packages/utils/src/mergeObjects.ts
// https://github.com/mui/base-ui — exact copy.

export function mergeObjects<A extends object | undefined, B extends object | undefined>(
  a: A,
  b: B,
) {
  if (a && !b) {
    return a;
  }
  if (!a && b) {
    return b;
  }
  if (a || b) {
    return { ...a, ...b };
  }
  return undefined;
}
