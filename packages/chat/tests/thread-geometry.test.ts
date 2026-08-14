import { describe, expect, test } from "bun:test";
import {
  DEFAULT_BOTTOM_OFFSET,
  DOCK_SELECTOR,
  measureDockInset,
  measureTopInset,
  queryDock,
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

describe("queryDock", () => {
  test("returns the Thread.Composer slot", () => {
    const dock = { id: "dock" };
    let queried: string | undefined;
    const root = {
      querySelector: (selector: string) => {
        queried = selector;
        return dock;
      },
    } as unknown as HTMLElement;
    expect(queryDock(root)).toBe(dock as unknown as HTMLElement);
    expect(queried).toBe(DOCK_SELECTOR);
  });

  test("null when the slot isn't mounted", () => {
    const root = { querySelector: () => null } as unknown as HTMLElement;
    expect(queryDock(root)).toBeNull();
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
  const rootWith = (dock: unknown) =>
    ({
      querySelector: () => dock,
      getBoundingClientRect: () => ({ bottom: 600 }),
    }) as unknown as HTMLElement;

  test("measures from the dock's top to the root bottom + gap", () => {
    // 600 - 540 + COMPOSER_GAP(32) = 92
    expect(measureDockInset(rootWith({ getBoundingClientRect: () => ({ top: 540 }) }))).toBe(92);
  });

  test("reserves the space beneath a dock that floats above the bottom edge", () => {
    // The slot's own height would under-reserve; measuring to the root bottom doesn't.
    expect(measureDockInset(rootWith({ getBoundingClientRect: () => ({ top: 400 }) }))).toBe(232);
  });

  test("null when the dock isn't mounted yet", () => {
    expect(measureDockInset(rootWith(null))).toBeNull();
  });
});

describe("constants", () => {
  test("expose the documented defaults", () => {
    expect(DEFAULT_BOTTOM_OFFSET).toBe(128);
    expect(DOCK_SELECTOR).toBe("[data-thread-composer]");
  });
});
