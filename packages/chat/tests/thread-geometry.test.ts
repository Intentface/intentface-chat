import { describe, expect, test } from "bun:test";
import {
  DEFAULT_BOTTOM_OFFSET,
  DEFAULT_DOCK_SELECTOR,
  measureDockInset,
  measureTopInset,
  queryDockParts,
  scrollContainerTo,
  wasPrepended,
} from "../src/thread/geometry";

// geometry.ts only touches scrollTo / querySelector(All) / getBoundingClientRect,
// so we stub exactly those rather than needing a DOM (shadcn's stubbed-rects style).

describe("scrollContainerTo", () => {
  test("delegates to scrollTo with the top + behavior", () => {
    let captured: unknown;
    const el = {
      scrollTo: (options: unknown) => {
        captured = options;
      },
    } as unknown as HTMLElement;
    scrollContainerTo(el, 120, "smooth");
    expect(captured).toEqual({ top: 120, behavior: "smooth" });
  });
});

describe("wasPrepended", () => {
  const mutation = (added: number, removed: number) =>
    ({
      addedNodes: { length: added },
      removedNodes: { length: removed },
    }) as unknown as MutationRecord;
  const content = (firstElementChild: unknown) => ({ firstElementChild }) as unknown as HTMLElement;

  test("true when rows were added, none removed, and the old first row moved down but stays connected", () => {
    const oldFirst = { isConnected: true } as unknown as Element;
    const newFirst = { isConnected: true } as unknown as Element;
    expect(wasPrepended([mutation(2, 0)], oldFirst, content(newFirst))).toBe(true);
  });

  test("false when anything was removed", () => {
    const oldFirst = { isConnected: true } as unknown as Element;
    const newFirst = {} as unknown as Element;
    expect(wasPrepended([mutation(1, 1)], oldFirst, content(newFirst))).toBe(false);
  });

  test("false when the previous first row is still first (append, not prepend)", () => {
    const first = { isConnected: true } as unknown as Element;
    expect(wasPrepended([mutation(1, 0)], first, content(first))).toBe(false);
  });

  test("false when there was no previous first row", () => {
    expect(wasPrepended([mutation(1, 0)], null, content({}))).toBe(false);
  });
});

describe("queryDockParts", () => {
  test("returns the matches for a valid selector", () => {
    const parts = [{ id: 1 }, { id: 2 }];
    const root = { querySelectorAll: () => parts } as unknown as HTMLElement;
    expect(queryDockParts(root, ".dock")).toEqual(parts as unknown as Element[]);
  });

  test("degrades to [] on an invalid selector instead of throwing", () => {
    const root = {
      querySelectorAll: () => {
        throw new SyntaxError("bad selector");
      },
    } as unknown as HTMLElement;
    expect(queryDockParts(root, "!!!")).toEqual([]);
  });
});

describe("measureTopInset", () => {
  test("returns the top overlay's height", () => {
    const root = {
      querySelector: () => ({ getBoundingClientRect: () => ({ height: 64 }) }),
    } as unknown as HTMLElement;
    expect(measureTopInset(root)).toBe(64);
  });

  test("returns 0 when there is no top overlay", () => {
    const root = { querySelector: () => null } as unknown as HTMLElement;
    expect(measureTopInset(root)).toBe(0);
  });
});

describe("measureDockInset", () => {
  test("measures from the bottom-most dock part's top to the root bottom + gap", () => {
    const parts = [
      { getBoundingClientRect: () => ({ top: 500 }) },
      { getBoundingClientRect: () => ({ top: 540 }) }, // bottom-most (largest top)
    ];
    const root = {
      querySelectorAll: () => parts,
      getBoundingClientRect: () => ({ bottom: 600 }),
    } as unknown as HTMLElement;
    // 600 - 540 + COMPOSER_GAP(32) = 92
    expect(measureDockInset(root, ".dock")).toBe(92);
  });

  test("null when no dock parts are mounted yet", () => {
    const root = {
      querySelectorAll: () => [],
      getBoundingClientRect: () => ({ bottom: 600 }),
    } as unknown as HTMLElement;
    expect(measureDockInset(root, ".dock")).toBeNull();
  });
});

describe("constants", () => {
  test("expose the documented defaults", () => {
    expect(DEFAULT_BOTTOM_OFFSET).toBe(128);
    expect(DEFAULT_DOCK_SELECTOR).toContain("composer-container");
  });
});
