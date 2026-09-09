import { describe, expect, test } from "bun:test";
import { act, fireEvent, render } from "@testing-library/react";
import { SHELL_SIDEBAR_WIDTH_VAR, Shell } from "../src/shell";
import { createShellStore } from "../src/shell/store";

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const PEEK_OPEN = 200;
const PEEK_CLOSE = 250;

const Layout = (props: Parameters<typeof Shell.Root>[0]) => (
  <Shell.Root data-testid="root" {...props}>
    <Shell.PeekZone data-testid="zone" />
    <Shell.Sidebar data-testid="sidebar">
      <Shell.Trigger data-testid="trigger">Toggle</Shell.Trigger>
      <Shell.ResizeHandle aria-label="Resize sidebar" data-testid="handle" />
    </Shell.Sidebar>
    <Shell.Viewport data-testid="viewport" />
  </Shell.Root>
);

describe("Shell.Root", () => {
  test("publishes open state as data-state on every part", () => {
    const { getByTestId } = render(<Layout />);
    expect(getByTestId("sidebar").getAttribute("data-state")).toBe("expanded");
    expect(getByTestId("viewport").getAttribute("data-state")).toBe("expanded");
  });

  test("defaultOpen decides the very first render — no flash to correct", () => {
    const { getByTestId } = render(<Layout defaultOpen={false} />);
    expect(getByTestId("sidebar").getAttribute("data-state")).toBe("collapsed");
  });

  test("claims no window-level key of its own", () => {
    const { getByTestId } = render(<Layout />);

    act(() => void fireEvent.keyDown(window, { key: "b", metaKey: true }));
    expect(getByTestId("sidebar").getAttribute("data-state")).toBe("expanded");
  });

  test("`toggle` is all an app shortcut needs — a peeking sidebar pins open", () => {
    const store = createShellStore();
    const { getByTestId } = render(<Layout store={store} defaultOpen={false} />);
    const sidebar = getByTestId("sidebar");

    act(() => store.getSnapshot().setPeek(true));
    expect(sidebar.hasAttribute("data-peek")).toBe(true);

    // What a Cmd/Ctrl+B handler in the app would call.
    act(() => store.getSnapshot().toggle());

    expect(sidebar.getAttribute("data-state")).toBe("expanded");
    expect(sidebar.hasAttribute("data-peek")).toBe(false);
  });

  test("an explicit store handle drives the same tree", () => {
    const store = createShellStore();
    const { getByTestId } = render(<Layout store={store} />);

    act(() => store.getSnapshot().setOpen(false));
    expect(getByTestId("sidebar").getAttribute("data-state")).toBe("collapsed");
  });

  test("parts outside a Root throw rather than reading from nowhere", () => {
    expect(() => render(<Shell.Viewport />)).toThrow(
      "Shell parts must be used within <Shell.Root>",
    );
  });
});

describe("controlled open", () => {
  test("the prop wins and the store does not self-commit", () => {
    const seen: boolean[] = [];
    const { getByTestId } = render(<Layout onOpenChange={(open) => seen.push(open)} open={true} />);

    act(() => void fireEvent.click(getByTestId("trigger")));

    expect(seen).toEqual([false]);
    // Still open: the owner of the prop has not changed its mind.
    expect(getByTestId("sidebar").getAttribute("data-state")).toBe("expanded");
  });

  test("a new prop value reaches the DOM", () => {
    const { getByTestId, rerender } = render(<Layout open={true} />);
    rerender(<Layout open={false} />);
    expect(getByTestId("sidebar").getAttribute("data-state")).toBe("collapsed");
  });
});

describe("Shell.Trigger", () => {
  test("toggles and reports the state it controls", () => {
    const { getByTestId } = render(<Layout />);
    const trigger = getByTestId("trigger");

    expect(trigger.getAttribute("aria-expanded")).toBe("true");
    act(() => void fireEvent.click(trigger));
    expect(trigger.getAttribute("aria-expanded")).toBe("false");
  });

  test("aria-controls points at the sidebar it opens", () => {
    const { getByTestId } = render(<Layout />);
    const id = getByTestId("sidebar").getAttribute("id");

    expect(id).toBeTruthy();
    expect(getByTestId("trigger").getAttribute("aria-controls")).toBe(id);
  });
});

describe("peek", () => {
  test("resting in the zone floats a collapsed sidebar out", async () => {
    const { getByTestId } = render(<Layout defaultOpen={false} />);
    const sidebar = getByTestId("sidebar");

    fireEvent.pointerEnter(getByTestId("zone"));
    expect(sidebar.hasAttribute("data-peek")).toBe(false);

    await act(() => wait(PEEK_OPEN + 40));
    expect(sidebar.hasAttribute("data-peek")).toBe(true);
  });

  test("darting through the zone never opens it", async () => {
    const { getByTestId } = render(<Layout defaultOpen={false} />);
    const zone = getByTestId("zone");

    fireEvent.pointerEnter(zone);
    fireEvent.pointerLeave(zone);

    await act(() => wait(PEEK_OPEN + 40));
    expect(getByTestId("sidebar").hasAttribute("data-peek")).toBe(false);
  });

  test("collapsing under a parked pointer does not bounce straight back", async () => {
    const { getByTestId } = render(<Layout />);
    const zone = getByTestId("zone");

    // Pointer is already in the strip when the sidebar collapses out from
    // under it — the case the suppression guard exists for.
    fireEvent.pointerEnter(zone);
    act(() => void fireEvent.click(getByTestId("trigger")));
    fireEvent.pointerEnter(zone);

    await act(() => wait(PEEK_OPEN + 40));
    expect(getByTestId("sidebar").hasAttribute("data-peek")).toBe(false);
  });

  test("leaving the strip clears the guard, so the next hover works", async () => {
    const { getByTestId } = render(<Layout />);
    const zone = getByTestId("zone");

    fireEvent.pointerEnter(zone);
    act(() => void fireEvent.click(getByTestId("trigger")));
    fireEvent.pointerLeave(zone);

    fireEvent.pointerEnter(zone);
    await act(() => wait(PEEK_OPEN + 40));
    expect(getByTestId("sidebar").hasAttribute("data-peek")).toBe(true);
  });

  test("collapsing away from the strip leaves no guard behind", async () => {
    const store = createShellStore();
    const { getByTestId } = render(<Layout store={store} />);
    const zone = getByTestId("zone");

    // Collapsed from elsewhere — an app shortcut, a command palette — with the
    // pointer nowhere near the edge. The guard is armed by every collapse, so
    // without the pointer-move clearing it would still be set here and would
    // swallow this first genuine hover.
    act(() => store.getSnapshot().toggle());
    fireEvent.pointerMove(getByTestId("viewport"));

    fireEvent.pointerEnter(zone);
    await act(() => wait(PEEK_OPEN + 40));
    expect(getByTestId("sidebar").hasAttribute("data-peek")).toBe(true);
  });

  test("a pointer move inside the strip does not clear the guard", async () => {
    const { getByTestId } = render(<Layout />);
    const zone = getByTestId("zone");

    fireEvent.pointerEnter(zone);
    act(() => void fireEvent.click(getByTestId("trigger")));
    // Twitching within the strip is not proof the pointer was ever elsewhere.
    fireEvent.pointerMove(zone);
    fireEvent.pointerEnter(zone);

    await act(() => wait(PEEK_OPEN + 40));
    expect(getByTestId("sidebar").hasAttribute("data-peek")).toBe(false);
  });

  test("moving onto the panel keeps it out; leaving it puts it back", async () => {
    const { getByTestId } = render(<Layout defaultOpen={false} />);
    const sidebar = getByTestId("sidebar");
    const zone = getByTestId("zone");

    fireEvent.pointerEnter(zone);
    await act(() => wait(PEEK_OPEN + 40));

    fireEvent.pointerLeave(zone);
    fireEvent.pointerEnter(sidebar);
    await act(() => wait(PEEK_CLOSE + 40));
    expect(sidebar.hasAttribute("data-peek")).toBe(true);

    fireEvent.pointerLeave(sidebar);
    await act(() => wait(PEEK_CLOSE + 40));
    expect(sidebar.hasAttribute("data-peek")).toBe(false);
  });

  test("the trigger inside a floated sidebar pins it open rather than closing it", async () => {
    const { getByTestId } = render(<Layout defaultOpen={false} />);
    const sidebar = getByTestId("sidebar");

    fireEvent.pointerEnter(getByTestId("zone"));
    await act(() => wait(PEEK_OPEN + 40));

    act(() => void fireEvent.click(getByTestId("trigger")));
    expect(sidebar.getAttribute("data-state")).toBe("expanded");
    expect(sidebar.hasAttribute("data-peek")).toBe(false);
  });

  test("cmd-tabbing away mid-peek dismisses it — no pointerleave ever arrives", async () => {
    const { getByTestId } = render(<Layout defaultOpen={false} />);
    const sidebar = getByTestId("sidebar");

    fireEvent.pointerEnter(getByTestId("zone"));
    await act(() => wait(PEEK_OPEN + 40));
    expect(sidebar.hasAttribute("data-peek")).toBe(true);

    act(() => void fireEvent.blur(window));
    expect(sidebar.hasAttribute("data-peek")).toBe(false);
  });
});

describe("Shell.ResizeHandle", () => {
  /** The bounds are the stylesheet's to declare, so the tests declare them. */
  const withBounds = (sidebar: HTMLElement, min: string, max: string) => {
    sidebar.style.minWidth = min;
    sidebar.style.maxWidth = max;
  };

  const widthVar = (root: HTMLElement) => root.style.getPropertyValue(SHELL_SIDEBAR_WIDTH_VAR);

  test("is a focusable separator", () => {
    const handle = render(<Layout />).getByTestId("handle");

    expect(handle.getAttribute("role")).toBe("separator");
    expect(handle.getAttribute("aria-orientation")).toBe("vertical");
    expect(handle.getAttribute("tabindex")).toBe("0");
  });

  test("always carries a value, even before the first measurement", () => {
    // A focusable separator is invalid without one, and offsetWidth is 0 here.
    expect(
      render(<Layout />)
        .getByTestId("handle")
        .getAttribute("aria-valuenow"),
    ).toBe("0");
  });

  test("reports the range its stylesheet declares", () => {
    const { getByTestId, rerender } = render(<Layout />);
    withBounds(getByTestId("sidebar"), "200px", "400px");
    // Bounds are re-read when the measured width changes; nudge a render.
    rerender(<Layout />);

    act(() => void fireEvent.keyDown(getByTestId("handle"), { key: "ArrowRight" }));
    expect(getByTestId("handle").getAttribute("aria-valuemin")).toBe("200");
    expect(getByTestId("handle").getAttribute("aria-valuemax")).toBe("400");
  });

  test("publishes the width on the root, where siblings can read it", () => {
    const { getByTestId } = render(<Layout />);
    const sidebar = getByTestId("sidebar");
    withBounds(sidebar, "0px", "none");

    act(() => void fireEvent.keyDown(getByTestId("handle"), { key: "ArrowRight" }));

    // offsetWidth is 0 without layout, so this reads as a pure +step delta.
    expect(widthVar(getByTestId("root"))).toBe("16px");
    expect(sidebar.style.getPropertyValue(SHELL_SIDEBAR_WIDTH_VAR)).toBe("");
  });

  test("keys it does not own are left alone", () => {
    const { getByTestId } = render(<Layout />);
    act(() => void fireEvent.keyDown(getByTestId("handle"), { key: "ArrowUp" }));
    expect(widthVar(getByTestId("root"))).toBe("");
  });

  test("a drag flags resizing, tracks the pointer, and clears on release", () => {
    const { getByTestId } = render(<Layout />);
    withBounds(getByTestId("sidebar"), "0px", "none");
    const handle = getByTestId("handle");

    act(() => void fireEvent.pointerDown(handle, { button: 0, clientX: 100, pointerId: 1 }));
    expect(getByTestId("sidebar").getAttribute("data-resizing")).toBe("");

    act(() => void fireEvent.pointerMove(handle, { clientX: 150, pointerId: 1 }));
    expect(widthVar(getByTestId("root"))).toBe("50px");

    act(() => void fireEvent.pointerUp(handle, { pointerId: 1 }));
    expect(getByTestId("sidebar").hasAttribute("data-resizing")).toBe(false);
  });

  test("a right-hand sidebar widens when dragged the other way", () => {
    const { getByTestId } = render(
      <Shell.Root data-testid="root">
        <Shell.Sidebar data-testid="sidebar" side="right">
          <Shell.ResizeHandle data-testid="handle" />
        </Shell.Sidebar>
      </Shell.Root>,
    );
    withBounds(getByTestId("sidebar"), "0px", "none");
    const handle = getByTestId("handle");

    act(() => void fireEvent.pointerDown(handle, { button: 0, clientX: 100, pointerId: 1 }));
    act(() => void fireEvent.pointerMove(handle, { clientX: 50, pointerId: 1 }));

    expect(widthVar(getByTestId("root"))).toBe("50px");
  });

  test("the published width is clamped to the declared range", () => {
    const { getByTestId } = render(<Layout />);
    withBounds(getByTestId("sidebar"), "10px", "30px");
    const handle = getByTestId("handle");

    act(() => void fireEvent.pointerDown(handle, { button: 0, clientX: 0, pointerId: 1 }));

    act(() => void fireEvent.pointerMove(handle, { clientX: 500, pointerId: 1 }));
    expect(widthVar(getByTestId("root"))).toBe("30px");

    act(() => void fireEvent.pointerMove(handle, { clientX: -500, pointerId: 1 }));
    expect(widthVar(getByTestId("root"))).toBe("10px");
  });

  test("a drag that ends without a pointerup still clears", () => {
    const { getByTestId } = render(<Layout />);
    const sidebar = getByTestId("sidebar");

    act(
      () =>
        void fireEvent.pointerDown(getByTestId("handle"), { button: 0, clientX: 0, pointerId: 1 }),
    );
    expect(sidebar.getAttribute("data-resizing")).toBe("");

    act(() => void fireEvent.blur(window));
    expect(sidebar.hasAttribute("data-resizing")).toBe(false);
  });

  test("a non-primary button does not start a drag", () => {
    const { getByTestId } = render(<Layout />);

    act(
      () =>
        void fireEvent.pointerDown(getByTestId("handle"), { button: 2, clientX: 0, pointerId: 1 }),
    );
    expect(getByTestId("sidebar").hasAttribute("data-resizing")).toBe(false);
  });
});
