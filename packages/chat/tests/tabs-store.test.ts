import { describe, expect, test } from "bun:test";
import { createTabsStore } from "../src/tabs/store";

/** A store wired to record everything it reports out. */
const reporting = () => {
  const store = createTabsStore();
  const values: (string | null)[] = [];
  const items: string[][] = [];
  store.onValueChangeRef.current = (value) => void values.push(value);
  store.onItemsChangeRef.current = (next) => void items.push(next);
  return { store, values, items };
};

/** A store holding three open tabs with the middle one showing. */
const seeded = () => {
  const store = createTabsStore();
  store.hydrate({ items: ["a", "b", "c"], value: "b" });
  return store;
};

/** …and one that hands over on close, which is now opt-in. */
const handingOver = (policy: "adjacent" | "recent" = "adjacent") => {
  const store = seeded();
  store.selectOnCloseRef.current = policy;
  return store;
};

describe("createTabsStore", () => {
  test("starts empty, with nothing open", () => {
    const state = createTabsStore().getSnapshot();
    expect(state.value).toBeNull();
    expect(state.items).toEqual([]);
    expect(state.recent).toEqual([]);
    expect(state.hasViewport).toBe(false);
  });

  test("open adds a tab and selects it", () => {
    const store = createTabsStore();
    store.getSnapshot().open("a");

    expect(store.getSnapshot().items).toEqual(["a"]);
    expect(store.getSnapshot().value).toBe("a");
  });

  test("opening something already there moves it rather than duplicating", () => {
    const store = seeded();
    store.getSnapshot().open("a", { at: 2 });

    expect(store.getSnapshot().items).toEqual(["b", "c", "a"]);
    expect(store.getSnapshot().value).toBe("a");
  });

  test("selecting the same tab twice notifies once", () => {
    const store = seeded();
    let notifications = 0;
    store.subscribe(() => {
      notifications += 1;
    });

    store.getSnapshot().select("b");
    expect(notifications).toBe(0);
  });

  test("action identities survive updates", () => {
    const store = seeded();
    const { open, close } = store.getSnapshot();
    store.getSnapshot().select("a");

    expect(store.getSnapshot().open).toBe(open);
    expect(store.getSnapshot().close).toBe(close);
  });

  test("move reorders without disturbing the selection", () => {
    const store = seeded();
    store.getSnapshot().move("c", 0);

    expect(store.getSnapshot().items).toEqual(["c", "a", "b"]);
    expect(store.getSnapshot().value).toBe("b");
  });

  test("selectRelative steps and wraps", () => {
    const store = seeded();
    store.getSnapshot().selectRelative(1);
    expect(store.getSnapshot().value).toBe("c");

    store.getSnapshot().selectRelative(1);
    expect(store.getSnapshot().value).toBe("a");

    store.getSnapshot().selectRelative(-1, { loop: false });
    expect(store.getSnapshot().value).toBe("a");
  });
});

describe("close", () => {
  test("hands over to the neighbour by default", () => {
    const store = handingOver();
    store.getSnapshot().close("b");

    expect(store.getSnapshot().items).toEqual(["a", "c"]);
    expect(store.getSnapshot().value).toBe("c");
  });

  test("closing the tail falls back to the new tail", () => {
    const store = handingOver();
    store.getSnapshot().select("c");
    store.getSnapshot().close("c");

    expect(store.getSnapshot().value).toBe("b");
  });

  test("closing a tab that wasn't open leaves the selection alone", () => {
    const store = handingOver();
    store.getSnapshot().close("a");

    expect(store.getSnapshot().items).toEqual(["b", "c"]);
    expect(store.getSnapshot().value).toBe("b");
  });

  test("closing the last tab leaves nothing open", () => {
    const store = createTabsStore();
    store.selectOnCloseRef.current = "adjacent";
    store.hydrate({ items: ["a"], value: "a" });

    store.getSnapshot().close("a");
    expect(store.getSnapshot().items).toEqual([]);
    expect(store.getSnapshot().value).toBeNull();
  });

  test("unset means nothing is opened after a close", () => {
    const store = seeded();

    store.getSnapshot().close("b");
    expect(store.getSnapshot().value).toBeNull();
    expect(store.getSnapshot().items).toEqual(["a", "c"]);
  });

  test("the 'recent' policy goes back to where you were", () => {
    const store = handingOver("recent");

    store.getSnapshot().select("a");
    store.getSnapshot().select("c");
    store.getSnapshot().close("c");

    // "a" was the previous tab; the neighbour would have been "b".
    expect(store.getSnapshot().value).toBe("a");
  });

  test("'recent' falls back to the neighbour with no history to go on", () => {
    const store = handingOver("recent");

    store.getSnapshot().close("b");
    expect(store.getSnapshot().value).toBe("c");
  });

  test("'recent' skips tabs that have since been closed", () => {
    const store = createTabsStore();
    store.selectOnCloseRef.current = "recent";
    store.hydrate({ items: ["a", "b", "c"], value: null });

    store.getSnapshot().select("a");
    store.getSnapshot().select("b");
    store.getSnapshot().close("a");
    store.getSnapshot().close("b");

    expect(store.getSnapshot().value).toBe("c");
  });
});

describe("activation direction", () => {
  /* No elements are registered here, so these exercise the fallback: list
     order. Which is a better fallback than comparing the values themselves —
     we own the order, so we can just look it up. */
  test("reports which way the selection moved", () => {
    const store = seeded();

    store.getSnapshot().select("c");
    expect(store.getSnapshot().direction).toBe("right");

    store.getSnapshot().select("a");
    expect(store.getSnapshot().direction).toBe("left");
  });

  test("follows the collection's order, not the ids", () => {
    const store = seeded();
    store.getSnapshot().move("c", 0);

    // "c" now sits before "b", so selecting it is a move left.
    store.getSnapshot().select("c");
    expect(store.getSnapshot().direction).toBe("left");
  });

  test("a vertical collection moves up and down", () => {
    const store = seeded();
    store.orientationRef.current = "vertical";

    store.getSnapshot().select("c");
    expect(store.getSnapshot().direction).toBe("down");

    store.getSnapshot().select("a");
    expect(store.getSnapshot().direction).toBe("up");
  });

  test("opening or closing everything has no direction", () => {
    const store = seeded();
    store.getSnapshot().select(null);
    expect(store.getSnapshot().direction).toBe("none");
  });

  test("a tab opened and selected in one go has no direction to report", () => {
    const store = createTabsStore();
    store.getSnapshot().open("a");
    expect(store.getSnapshot().direction).toBe("none");
  });

  test("stays put until the next change, so exit styles can still read it", () => {
    const store = seeded();
    store.getSnapshot().select("c");
    expect(store.getSnapshot().direction).toBe("right");
  });
});

describe("controlled", () => {
  test("value: reports the request without committing it", () => {
    const store = seeded();
    const seen: (string | null)[] = [];
    store.valueControlledRef.current = true;
    store.onValueChangeRef.current = (value) => seen.push(value);

    store.getSnapshot().select("c");

    expect(seen).toEqual(["c"]);
    expect(store.getSnapshot().value).toBe("b");
  });

  test("items: reports the request without committing it", () => {
    const store = seeded();
    const seen: string[][] = [];
    store.itemsControlledRef.current = true;
    store.onItemsChangeRef.current = (items) => seen.push(items);

    store.getSnapshot().move("c", 0);

    expect(seen).toEqual([["c", "a", "b"]]);
    expect(store.getSnapshot().items).toEqual(["a", "b", "c"]);
  });

  test("commit is how the owner pushes its decision back in", () => {
    const store = seeded();
    store.valueControlledRef.current = true;
    store.itemsControlledRef.current = true;

    store.commitValue("c");
    store.commitItems(["c", "b", "a"]);

    expect(store.getSnapshot().value).toBe("c");
    expect(store.getSnapshot().items).toEqual(["c", "b", "a"]);
  });
});

describe("hydrate", () => {
  test("seeds without notifying or reporting back", () => {
    const { store, values, items } = reporting();
    let notifications = 0;
    store.subscribe(() => {
      notifications += 1;
    });

    store.hydrate({ items: ["a", "b"], value: "a" });

    expect(store.getSnapshot().value).toBe("a");
    expect(notifications).toBe(0);
    expect(values).toEqual([]);
    expect(items).toEqual([]);
  });

  test("drops a restored selection whose tab is gone", () => {
    const store = createTabsStore();
    store.hydrate({ items: ["a", "b"], value: "removed" });

    expect(store.getSnapshot().value).toBeNull();
  });
});

describe("the viewport", () => {
  test("registration is reflected in the snapshot", () => {
    const store = seeded();
    store.registerViewport(true);
    expect(store.getSnapshot().hasViewport).toBe(true);

    store.registerViewport(false);
    expect(store.getSnapshot().hasViewport).toBe(false);
  });

  test("registering the same state twice notifies once", () => {
    const store = seeded();
    let notifications = 0;
    store.subscribe(() => {
      notifications += 1;
    });

    store.registerViewport(true);
    store.registerViewport(true);
    expect(notifications).toBe(1);
  });

  test("the element registry is imperative, not part of the snapshot", () => {
    const store = seeded();
    const before = store.getSnapshot();

    store.registerElement("b", {} as HTMLElement);
    expect(store.getSnapshot()).toBe(before);
    expect(store.elements.has("b")).toBe(true);

    store.registerElement("b", null);
    expect(store.elements.has("b")).toBe(false);
  });
});

describe("reporting changes out", () => {
  test("reports the collection and the selection separately", () => {
    const { store, values, items } = reporting();

    store.getSnapshot().open("a");

    expect(items).toEqual([["a"]]);
    expect(values).toEqual(["a"]);
  });

  test("reports a close through both channels", () => {
    const { store, values, items } = reporting();
    store.hydrate({ items: ["a", "b", "c"], value: "b" });
    store.selectOnCloseRef.current = "adjacent";

    store.getSnapshot().close("b");

    expect(items).toEqual([["a", "c"]]);
    expect(values).toEqual(["c"]);
  });

  test("works with nothing listening", () => {
    const store = seeded();
    expect(() => store.getSnapshot().close("b")).not.toThrow();
  });
});
