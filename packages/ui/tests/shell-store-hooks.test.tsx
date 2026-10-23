import { describe, expect, spyOn, test } from "bun:test";
import { act, render } from "@testing-library/react";
import type { ReactNode } from "react";
import { createShellStore, ShellStoreContext, useShell, useShellStore } from "../src/shell/store";

/**
 * A store put into a known state. `open` is seedable the way Shell.Root seeds
 * it, before anything subscribes; `width` is a measurement rather than seedable
 * state, so it is reported the way the sidebar reports one.
 */
const seeded = ({ open, width }: { open?: boolean; width?: number }) => {
  const store = createShellStore();
  if (open !== undefined) store.hydrate({ open });
  if (width !== undefined) store.getSnapshot().setWidth(width);
  return store;
};

const provider = (store: ReturnType<typeof createShellStore>) => {
  const Wrapper = ({ children }: { children: ReactNode }) => (
    <ShellStoreContext value={store}>{children}</ShellStoreContext>
  );
  return Wrapper;
};

describe("useShellStore", () => {
  test("reads an explicit handle from outside any provider", () => {
    const store = seeded({ width: 260 });
    const Outside = () => <output>{useShellStore(store, (shell) => shell.width)}</output>;

    const { container } = render(<Outside />);
    expect(container.textContent).toBe("260");

    act(() => store.getSnapshot().setWidth(300));
    expect(container.textContent).toBe("300");
  });

  test("a selector confines re-renders to the value it selects", () => {
    const store = createShellStore();
    let renders = 0;
    const WidthOnly = () => {
      renders += 1;
      return <output>{useShellStore(store, (shell) => shell.width)}</output>;
    };

    render(<WidthOnly />);
    expect(renders).toBe(1);

    // Not selected: no render.
    act(() => store.getSnapshot().setOpen(false));
    expect(renders).toBe(1);

    // Selected: one render.
    act(() => store.getSnapshot().setWidth(320));
    expect(renders).toBe(2);
  });

  test("without a selector it hands back the whole snapshot", () => {
    const store = seeded({ open: false });
    const All = () => <output>{String(useShellStore(store).open)}</output>;

    const { container } = render(<All />);
    expect(container.textContent).toBe("false");
  });
});

describe("useShell", () => {
  test("resolves the store from the nearest Shell.Root", () => {
    const store = seeded({ width: 280 });
    const Part = () => <output>{useShell((shell) => shell.width)}</output>;

    const { container } = render(<Part />, { wrapper: provider(store) });
    expect(container.textContent).toBe("280");

    act(() => store.getSnapshot().setWidth(200));
    expect(container.textContent).toBe("200");
  });

  test("two roots stay independent — there is no global fallback", () => {
    const first = seeded({ width: 200 });
    const second = seeded({ width: 400 });
    const Part = () => <output>{useShell((shell) => shell.width)}</output>;

    const { container } = render(
      <>
        <ShellStoreContext value={first}>
          <Part />
        </ShellStoreContext>
        <ShellStoreContext value={second}>
          <Part />
        </ShellStoreContext>
      </>,
    );
    expect(container.textContent).toBe("200400");

    act(() => first.getSnapshot().setWidth(240));
    expect(container.textContent).toBe("240400");
  });

  test("throws outside a provider rather than reading from nowhere", () => {
    const Orphan = () => <output>{useShell((shell) => shell.width)}</output>;
    // React logs the error boundary trace; the assertion is the throw itself.
    const error = spyOn(console, "error").mockImplementation(() => {});
    try {
      expect(() => render(<Orphan />)).toThrow("Shell parts must be used within <Shell.Root>");
    } finally {
      error.mockRestore();
    }
  });

  test("an action selected from the snapshot drives the store", () => {
    const store = seeded({ open: true });
    const Trigger = () => {
      const toggle = useShell((shell) => shell.toggle);
      return (
        <button onClick={toggle} type="button">
          {String(useShell((shell) => shell.open))}
        </button>
      );
    };

    const { container } = render(<Trigger />, { wrapper: provider(store) });
    const button = container.querySelector("button");

    expect(button?.textContent).toBe("true");
    act(() => button?.click());
    expect(button?.textContent).toBe("false");
  });
});
