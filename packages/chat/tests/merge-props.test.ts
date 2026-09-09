import { describe, expect, test } from "bun:test";
import { mergeProps } from "../src/internal/render/mergeProps";

// Coverage for the vendored prop merge under every part. The behaviours pinned here are the
// ones a part relies on without restating them: that passing `{...props}` through can't
// clobber an internal value with `undefined`, that refs are deliberately *not* merged here
// (useRenderElement does that separately), and that a consumer can suppress a primitive's own
// handler. None of it is covered upstream in this package.

describe("mergeProps", () => {
  test("rightmost wins for plain values", () => {
    expect(mergeProps({ id: "a", role: "tab" }, { id: "b" })).toEqual({ id: "b", role: "tab" });
  });

  // An explicit `undefined` on the right *does* clear the value — it is treated as "unset
  // this", not "leave it alone". Parts therefore put their own defaults in the leftmost
  // object and only ever read a consumer's `undefined` as deliberate.
  test("an explicit undefined on the right clears the value", () => {
    expect(mergeProps({ id: "a" }, { id: undefined })).toEqual({});
  });

  test("className concatenates, rightmost first", () => {
    expect(mergeProps({ className: "ours" }, { className: "theirs" }).className).toBe(
      "theirs ours",
    );
  });

  test("style merges shallowly, rightmost key winning", () => {
    const merged = mergeProps({ style: { color: "red", top: 0 } }, { style: { color: "blue" } });

    expect(merged.style).toEqual({ color: "blue", top: 0 });
  });

  // Carried through like any other value, rightmost winning — *not* combined. Composing
  // several refs onto one node is useRenderElement's job, which is why it reads the merged
  // `ref` back out and runs it through useMergedRefs with the part's own.
  test("ref passes through unmerged, rightmost winning", () => {
    const ours = { current: null };
    const theirs = { current: null };

    expect(mergeProps({ ref: ours }, { ref: theirs }).ref).toBe(theirs);
  });

  test("handlers all run, right to left, so the consumer's goes first", () => {
    const order: string[] = [];
    const merged = mergeProps(
      { onClick: () => order.push("ours") },
      { onClick: () => order.push("theirs") },
    );

    (merged.onClick as (event: object) => void)({});
    expect(order).toEqual(["theirs", "ours"]);
  });

  // The escape hatch is only installed on a React synthetic event, which is detected by the
  // presence of `nativeEvent` — so a plain object argument never gets it, and both handlers
  // run. That is what makes the suppression safe to rely on from a real DOM handler only.
  test("preventBaseUIHandler stops the handlers to the left", () => {
    const order: string[] = [];
    const merged = mergeProps(
      { onClick: () => order.push("ours") },
      {
        onClick: (event: { preventBaseUIHandler: () => void }) => {
          order.push("theirs");
          event.preventBaseUIHandler();
        },
      },
    );

    (merged.onClick as (event: object) => void)({ nativeEvent: new Event("click") });
    expect(order).toEqual(["theirs"]);
  });

  test("skips absent sources", () => {
    expect(mergeProps(undefined, { id: "a" }, undefined)).toEqual({ id: "a" });
  });
});
