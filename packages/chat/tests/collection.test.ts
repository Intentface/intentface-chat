import { describe, expect, test } from "bun:test";
import { adjacentTo, insertAt, moveTo, step } from "../src/internal/collection";

const ITEMS = ["a", "b", "c"] as const;

describe("adjacentTo", () => {
  test("hands over to whatever slides into the vacated slot", () => {
    expect(adjacentTo(ITEMS, "a")).toBe("b");
    expect(adjacentTo(ITEMS, "b")).toBe("c");
  });

  test("falls back to the new tail when the tail is removed", () => {
    expect(adjacentTo(ITEMS, "c")).toBe("b");
  });

  test("has nowhere to go when it was the only one", () => {
    expect(adjacentTo(["a"], "a")).toBeNull();
  });

  test("returns null for something that was never there", () => {
    expect(adjacentTo(ITEMS, "z")).toBeNull();
  });
});

describe("step", () => {
  test("moves one place in either direction", () => {
    expect(step(ITEMS, "a", 1)).toBe("b");
    expect(step(ITEMS, "b", -1)).toBe("a");
  });

  test("wraps at the edges by default", () => {
    expect(step(ITEMS, "c", 1)).toBe("a");
    expect(step(ITEMS, "a", -1)).toBe("c");
  });

  test("stays put at the edges when told not to loop", () => {
    expect(step(ITEMS, "c", 1, { loop: false })).toBe("c");
    expect(step(ITEMS, "a", -1, { loop: false })).toBe("a");
  });

  test("from nothing, arrives at the end it is heading away from", () => {
    expect(step(ITEMS, null, 1)).toBe("a");
    expect(step(ITEMS, null, -1)).toBe("c");
  });

  test("an unknown id behaves like nothing", () => {
    expect(step(ITEMS, "z", 1)).toBe("a");
  });

  test("an empty collection has no next", () => {
    expect(step([], null, 1)).toBeNull();
  });
});

describe("moveTo", () => {
  test("moves forwards and backwards", () => {
    expect(moveTo(ITEMS, "a", 2)).toEqual(["b", "c", "a"]);
    expect(moveTo(ITEMS, "c", 0)).toEqual(["c", "a", "b"]);
  });

  test("clamps a target outside the range", () => {
    expect(moveTo(ITEMS, "a", 99)).toEqual(["b", "c", "a"]);
    expect(moveTo(ITEMS, "c", -5)).toEqual(["c", "a", "b"]);
  });

  test("leaves the list alone for an unknown id", () => {
    expect(moveTo(ITEMS, "z", 0)).toEqual(["a", "b", "c"]);
  });
});

describe("insertAt", () => {
  test("appends by default", () => {
    expect(insertAt(ITEMS, "d")).toEqual(["a", "b", "c", "d"]);
  });

  test("inserts at a position", () => {
    expect(insertAt(ITEMS, "d", 1)).toEqual(["a", "d", "b", "c"]);
  });

  test("re-opening something already there moves it rather than duplicating", () => {
    expect(insertAt(ITEMS, "a", 2)).toEqual(["b", "c", "a"]);
    expect(insertAt(ITEMS, "a")).toEqual(["b", "c", "a"]);
  });
});
