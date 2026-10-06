import { describe, expect, mock, test } from "bun:test";
import { act, fireEvent, render } from "@testing-library/react";
import { useState } from "react";
import { Tabs, type TabsRootChangeEventDetails } from "../src/tabs";

type ValueChange = (value: string | null, eventDetails: TabsRootChangeEventDetails) => void;

const DELAY = 20;
const wait = (ms = DELAY * 2) => new Promise((resolve) => setTimeout(resolve, ms));
const settle = (ms?: number) => act(() => wait(ms));

const Dock = ({
  onValueChange,
  disabled,
  openOnHover = true,
  side,
  value,
  closeDelay = 0,
}: {
  onValueChange?: ValueChange;
  disabled?: boolean;
  openOnHover?: boolean;
  side?: "top" | "bottom";
  value?: string | null;
  closeDelay?: number;
}) => (
  <Tabs.Root
    defaultItems={["a", "b"]}
    defaultValue={null}
    value={value}
    onValueChange={onValueChange}
    data-testid="root"
  >
    <Tabs.List>
      {(id) => (
        <Tabs.Trigger
          value={id}
          openOnHover={openOnHover}
          openDelay={DELAY}
          closeDelay={closeDelay}
          disabled={disabled}
          data-testid={`tab-${id}`}
        >
          {id}
        </Tabs.Trigger>
      )}
    </Tabs.List>
    <Tabs.Portal>
      <Tabs.Positioner side={side}>
        <Tabs.Popup data-testid="popup">
          <Tabs.Viewport>{(id) => <input aria-label={`Reply in ${id}`} />}</Tabs.Viewport>
        </Tabs.Popup>
      </Tabs.Positioner>
    </Tabs.Portal>
  </Tabs.Root>
);

/** The selection held by the parent, as the docs demo does. */
const ControlledDock = () => {
  const [value, setValue] = useState<string | null>(null);
  return <Dock value={value} onValueChange={(next) => setValue(next)} />;
};

const mouse = { pointerType: "mouse" };

/** A mouse arriving on the tab and coming to rest there. */
const rest = async (element: HTMLElement, pointerType = "mouse") => {
  act(() => {
    fireEvent.pointerEnter(element, { pointerType });
    fireEvent.pointerMove(element, { pointerType });
  });
  await settle();
};

/** Off the tab into empty page, then on across it. */
const leave = async (element: HTMLElement) => {
  act(() => {
    fireEvent.pointerLeave(element, mouse);
    fireEvent.mouseMove(document, { clientX: 500, clientY: 500 });
  });
  await settle();
};

const isOpen = (tab: HTMLElement) => tab.getAttribute("aria-expanded") === "true";

/** happy-dom has no animations, so an exit ends at once; this holds one open until `finish`. */
const holdExitAnimation = () => {
  let finishAnimation!: () => void;
  const finished = new Promise<void>((resolve) => {
    finishAnimation = resolve;
  });
  let running = true;
  const prototype = Element.prototype as unknown as { getAnimations?: () => unknown[] };
  const original = prototype.getAnimations;
  prototype.getAnimations = () => (running ? [{ finished }] : []);
  return {
    finish: () => {
      running = false;
      finishAnimation();
    },
    restore: () => {
      prototype.getAnimations = original;
    },
  };
};

const placeAt = (
  element: HTMLElement,
  rect: { x: number; y: number; width: number; height: number },
) => {
  element.getBoundingClientRect = () =>
    ({
      ...rect,
      top: rect.y,
      left: rect.x,
      right: rect.x + rect.width,
      bottom: rect.y + rect.height,
    }) as DOMRect;
};

describe("openOnHover", () => {
  test("a mouse resting on the tab opens it, and says it was hover", async () => {
    const onValueChange = mock<ValueChange>();
    const { getByTestId } = render(<Dock onValueChange={onValueChange} />);

    await rest(getByTestId("tab-a"));

    expect(isOpen(getByTestId("tab-a"))).toBe(true);
    expect(onValueChange.mock.calls[0]?.[0]).toBe("a");
    expect(onValueChange.mock.calls[0]?.[1].reason).toBe("trigger-hover");
  });

  test("nothing opens before the delay", async () => {
    const { getByTestId } = render(<Dock />);
    const tab = getByTestId("tab-a");

    act(() => {
      fireEvent.pointerEnter(tab, mouse);
      fireEvent.pointerMove(tab, mouse);
    });

    expect(isOpen(tab)).toBe(false);
    await settle();
    expect(isOpen(tab)).toBe(true);
  });

  test("touch has no hover", async () => {
    const { getByTestId } = render(<Dock />);
    await rest(getByTestId("tab-a"), "touch");
    expect(isOpen(getByTestId("tab-a"))).toBe(false);
  });

  test("without the prop, resting does nothing", async () => {
    const { getByTestId } = render(<Dock openOnHover={false} />);
    await rest(getByTestId("tab-a"));
    expect(isOpen(getByTestId("tab-a"))).toBe(false);
  });

  test("a disabled tab does not open", async () => {
    const { getByTestId } = render(<Dock disabled />);
    await rest(getByTestId("tab-a"));
    expect(isOpen(getByTestId("tab-a"))).toBe(false);
  });

  test("leaving closes what hover opened", async () => {
    const onValueChange = mock<ValueChange>();
    const { getByTestId } = render(<Dock onValueChange={onValueChange} />);
    const tab = getByTestId("tab-a");
    await rest(tab);

    await leave(tab);

    expect(isOpen(tab)).toBe(false);
    expect(onValueChange.mock.calls.at(-1)?.[0]).toBeNull();
    expect(onValueChange.mock.calls.at(-1)?.[1].reason).toBe("trigger-hover");
  });

  test("moving straight onto another hover tab moves the popup instead of reopening it", async () => {
    const onValueChange = mock<ValueChange>();
    const { getByTestId } = render(<Dock onValueChange={onValueChange} />);
    const first = getByTestId("tab-a");
    const second = getByTestId("tab-b");
    await rest(first);
    const popup = getByTestId("popup");

    act(() => {
      fireEvent.pointerLeave(first, { ...mouse, relatedTarget: second });
      fireEvent.pointerEnter(second, { ...mouse, relatedTarget: first });
      fireEvent.mouseMove(document, { clientX: 500, clientY: 500 });
    });

    // At once, without resting, and never closed in between.
    expect(isOpen(second)).toBe(true);
    expect(onValueChange.mock.calls.map(([value]) => value)).toEqual(["a", "b"]);
    await settle();
    expect(getByTestId("popup")).toBe(popup);
  });

  test("crossing the gap between two hover tabs reopens the closing popup at once", async () => {
    const exit = holdExitAnimation();
    const { getByTestId } = render(<Dock />);
    const first = getByTestId("tab-a");
    const second = getByTestId("tab-b");
    await rest(first);
    const popup = getByTestId("popup");

    // Into the gap: the strip, not a tab, so the popup starts to close.
    await leave(first);
    expect(isOpen(first)).toBe(false);
    expect(popup.hasAttribute("data-ending-style")).toBe(true);

    act(() => void fireEvent.pointerEnter(second, mouse));

    expect(isOpen(second)).toBe(true);
    expect(getByTestId("popup")).toBe(popup);
    exit.finish();
    exit.restore();
  });

  test("a press on the tab keeps it open after the mouse leaves", async () => {
    const { getByTestId } = render(<Dock />);
    const tab = getByTestId("tab-a");
    await rest(tab);

    fireEvent.click(tab);
    await leave(tab);

    expect(isOpen(tab)).toBe(true);
  });

  test("hover changes are drawn at once, so a controlled popup fading out is taken over", async () => {
    const exit = holdExitAnimation();
    const { getByTestId } = render(<ControlledDock />);
    const first = getByTestId("tab-a");
    const second = getByTestId("tab-b");
    await rest(first);
    let fadingInBatch = false;

    act(() => {
      fireEvent.pointerLeave(first, mouse);
      fireEvent.mouseMove(document, { clientX: 500, clientY: 500 });
      // Still inside the batch: only an immediate redraw shows the fade by now.
      fadingInBatch = getByTestId("popup").hasAttribute("data-ending-style");
      fireEvent.pointerEnter(second, mouse);
    });

    expect(fadingInBatch).toBe(true);
    expect(isOpen(second)).toBe(true);
    exit.finish();
    exit.restore();
  });

  test("the close delay carries the mouse across the gap without closing at all", async () => {
    const onValueChange = mock<ValueChange>();
    const { getByTestId } = render(<Dock onValueChange={onValueChange} closeDelay={DELAY} />);
    const first = getByTestId("tab-a");
    const second = getByTestId("tab-b");
    await rest(first);

    act(() => {
      fireEvent.pointerLeave(first, mouse);
      fireEvent.mouseMove(document, { clientX: 500, clientY: 500 });
      fireEvent.pointerEnter(second, mouse);
    });
    await settle();

    expect(isOpen(second)).toBe(true);
    expect(onValueChange.mock.calls.map(([value]) => value)).toEqual(["a", "b"]);
  });

  test("a press before the delay runs out opens the tab for good", async () => {
    const { getByTestId } = render(<Dock />);
    const tab = getByTestId("tab-a");
    act(() => {
      fireEvent.pointerEnter(tab, mouse);
      fireEvent.pointerMove(tab, mouse);
    });

    fireEvent.click(tab);
    await settle();
    await leave(tab);

    expect(isOpen(tab)).toBe(true);
  });

  test("a press inside the popup keeps it open after the mouse leaves", async () => {
    const { getByTestId } = render(<Dock />);
    const tab = getByTestId("tab-a");
    await rest(tab);

    fireEvent.pointerDown(getByTestId("popup"));
    await leave(tab);

    expect(isOpen(tab)).toBe(true);
  });

  test("hover never takes over a tab someone opened on purpose", async () => {
    const { getByTestId } = render(<Dock />);
    fireEvent.click(getByTestId("tab-a"));

    await rest(getByTestId("tab-b"));

    expect(isOpen(getByTestId("tab-a"))).toBe(true);
    expect(isOpen(getByTestId("tab-b"))).toBe(false);
  });

  test("leaving a tab opened by a press does not close it", async () => {
    const { getByTestId } = render(<Dock />);
    const tab = getByTestId("tab-a");
    fireEvent.click(tab);

    await rest(tab);
    await leave(tab);

    expect(isOpen(tab)).toBe(true);
  });

  test("the mouse heading for the popup keeps it open, and wandering off closes it", async () => {
    const { getByTestId } = render(<Dock side="top" />);
    const tab = getByTestId("tab-a");
    // happy-dom lays nothing out, so give the Positioner room to keep the popup on top.
    const root = document.documentElement;
    Object.defineProperty(root, "clientWidth", { value: 1024, configurable: true });
    Object.defineProperty(root, "clientHeight", { value: 768, configurable: true });
    placeAt(tab, { x: 0, y: 300, width: 100, height: 30 });
    await rest(tab);
    placeAt(getByTestId("popup"), { x: 0, y: 90, width: 200, height: 200 });
    await settle();

    act(() => {
      fireEvent.pointerLeave(tab, { ...mouse, clientX: 50, clientY: 300 });
      fireEvent.mouseMove(document, { clientX: 52, clientY: 295 });
    });
    await settle();
    expect(isOpen(tab)).toBe(true);

    act(() => void fireEvent.mouseMove(document, { clientX: 600, clientY: 600 }));
    await settle(100);
    expect(isOpen(tab)).toBe(false);

    delete (root as { clientWidth?: number }).clientWidth;
    delete (root as { clientHeight?: number }).clientHeight;
  });
});
