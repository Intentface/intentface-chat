import { describe, expect, test } from "bun:test";
import { createShellStore } from "../src/shell/store";

/** A store wired to record everything it reports out. */
const reporting = () => {
  const store = createShellStore();
  const opens: boolean[] = [];
  const widths: number[] = [];
  store.onOpenChangeRef.current = (open) => void opens.push(open);
  store.onResizeRef.current = (width) => void widths.push(width);
  return { store, opens, widths };
};

const counting = (store: ReturnType<typeof createShellStore>) => {
  let notifications = 0;
  store.subscribe(() => {
    notifications += 1;
  });
  return () => notifications;
};

describe("createShellStore", () => {
  test("takes no arguments and starts open, unmeasured", () => {
    const state = createShellStore().getSnapshot();
    expect(state.open).toBe(true);
    expect(state.peek).toBe(false);
    expect(state.resizing).toBe(false);
    // Width is a CSS concern until the element exists to be measured.
    expect(state.width).toBeNull();
  });

  test("setOpen and toggle move the snapshot forward", () => {
    const store = createShellStore();
    store.getSnapshot().setOpen(false);
    expect(store.getSnapshot().open).toBe(false);

    store.getSnapshot().toggle();
    expect(store.getSnapshot().open).toBe(true);
  });

  test("setting a value it already has changes nothing and notifies nobody", () => {
    const store = createShellStore();
    const notifications = counting(store);
    const before = store.getSnapshot();

    store.getSnapshot().setOpen(true);
    store.getSnapshot().setResizing(false);

    expect(notifications()).toBe(0);
    expect(store.getSnapshot()).toBe(before);
  });

  test("action identities survive every update, so selecting one never re-renders", () => {
    const store = createShellStore();
    const { toggle, setWidth } = store.getSnapshot();

    store.getSnapshot().setOpen(false);
    store.getSnapshot().setWidth(300);

    expect(store.getSnapshot().toggle).toBe(toggle);
    expect(store.getSnapshot().setWidth).toBe(setWidth);
  });

  test("setWidth records a measurement verbatim — clamping belongs to CSS", () => {
    const store = createShellStore();
    store.getSnapshot().setWidth(9000);
    expect(store.getSnapshot().width).toBe(9000);
  });

  test("unsubscribing stops the notifications", () => {
    const store = createShellStore();
    let notifications = 0;
    const unsubscribe = store.subscribe(() => {
      notifications += 1;
    });

    store.getSnapshot().setOpen(false);
    unsubscribe();
    store.getSnapshot().setOpen(true);

    expect(notifications).toBe(1);
  });
});

describe("hydrate", () => {
  test("seeds state before anyone is watching", () => {
    const store = createShellStore();
    store.hydrate({ open: false });

    expect(store.getSnapshot().open).toBe(false);
  });

  test("takes no width — CSS has already decided that before anything here runs", () => {
    const store = createShellStore();
    store.hydrate({ open: false });

    expect(store.getSnapshot().width).toBeNull();
  });

  test("leaves out what it is not given", () => {
    const store = createShellStore();
    store.hydrate({ open: false });
    expect(store.getSnapshot().width).toBeNull();
  });

  test("does not notify — this runs before the first paint", () => {
    const store = createShellStore();
    const notifications = counting(store);

    store.hydrate({ open: false });
    expect(notifications()).toBe(0);
  });

  test("does not report back what it just restored", () => {
    const { store, opens, widths } = reporting();

    store.hydrate({ open: false });

    expect(opens).toEqual([]);
    expect(widths).toEqual([]);
  });
});

describe("peek", () => {
  test("does nothing while the sidebar is open — there is nothing to peek at", () => {
    const store = createShellStore();
    store.getSnapshot().setPeek(true);
    expect(store.getSnapshot().peek).toBe(false);
  });

  test("engages once collapsed", () => {
    const store = createShellStore();
    store.hydrate({ open: false });

    store.getSnapshot().setPeek(true);
    expect(store.getSnapshot().peek).toBe(true);
  });

  test("opening ends it", () => {
    const store = createShellStore();
    store.hydrate({ open: false });
    store.getSnapshot().setPeek(true);

    store.getSnapshot().setOpen(true);
    expect(store.getSnapshot().peek).toBe(false);
    expect(store.getSnapshot().open).toBe(true);
  });

  test("the suppression flag is imperative, not part of the snapshot", () => {
    const store = createShellStore();
    const before = store.getSnapshot();

    store.peekSuppressionRef.current = true;
    expect(store.getSnapshot()).toBe(before);
  });
});

describe("controlled open", () => {
  test("reports the request and commits it when nobody owns the prop", () => {
    const store = createShellStore();
    const seen: boolean[] = [];
    store.onOpenChangeRef.current = (open) => seen.push(open);

    store.getSnapshot().setOpen(false);

    expect(seen).toEqual([false]);
    expect(store.getSnapshot().open).toBe(false);
  });

  test("reports but does not commit while controlled", () => {
    const store = createShellStore();
    const seen: boolean[] = [];
    store.controlledRef.current = true;
    store.onOpenChangeRef.current = (open) => seen.push(open);

    store.getSnapshot().setOpen(false);

    expect(seen).toEqual([false]);
    expect(store.getSnapshot().open).toBe(true);
  });

  test("commitOpen is the way the owner pushes its decision back in", () => {
    const store = createShellStore();
    store.controlledRef.current = true;

    store.commitOpen(false);
    expect(store.getSnapshot().open).toBe(false);
  });
});

describe("reporting changes out", () => {
  test("reports open changes", () => {
    const { store, opens } = reporting();

    store.getSnapshot().setOpen(false);
    expect(opens).toEqual([false]);
  });

  test("reports nothing for width until something has measured it", () => {
    const { store, widths } = reporting();

    store.getSnapshot().setOpen(false);
    expect(widths).toEqual([]);

    store.getSnapshot().setWidth(280);
    expect(widths).toEqual([280]);
  });

  test("stays quiet during a drag, then reports once when it ends", () => {
    const { store, widths } = reporting();

    store.getSnapshot().setResizing(true);
    for (const width of [250, 260, 270, 280]) store.getSnapshot().setWidth(width);
    expect(widths).toEqual([]);

    store.getSnapshot().setResizing(false);
    expect(widths).toEqual([280]);
  });

  test("peek is never reported", () => {
    const { store, opens, widths } = reporting();
    store.hydrate({ open: false });

    store.getSnapshot().setPeek(true);

    expect(opens).toEqual([]);
    expect(widths).toEqual([]);
  });

  test("works with nothing listening", () => {
    const store = createShellStore();
    expect(() => {
      store.getSnapshot().setOpen(false);
      store.getSnapshot().setWidth(240);
    }).not.toThrow();
  });
});
