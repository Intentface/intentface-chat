import { describe, expect, test } from "bun:test";
import { act, fireEvent, render } from "@testing-library/react";
import { Tabs, useTabs } from "../src/tabs";

const wait = (ms = 20) => new Promise((resolve) => setTimeout(resolve, ms));
const settle = () => act(() => wait());

const Strip = () => {
  const items = useTabs((tabs) => tabs.items);

  return (
    <Tabs.List data-testid="list">
      {items.map((id) => (
        <Tabs.Trigger key={id} value={id} data-testid={`tab-${id}`}>
          {id}
          <Tabs.Close aria-label={`Close ${id}`} data-testid={`close-${id}`} />
        </Tabs.Trigger>
      ))}
    </Tabs.List>
  );
};

/** The floating composition: the same parts, with the viewport wrapped. */
const Dock = (root: Omit<Parameters<typeof Tabs.Root>[0], "children">) => (
  <Tabs.Root defaultItems={["a", "b"]} defaultValue={null} {...root}>
    <Strip />
    <Tabs.Portal>
      <Tabs.Positioner data-testid="positioner" side="top">
        <Tabs.Popup data-testid="popup">
          {/* Written inside the popup, which is where it renders. */}
          <Tabs.Viewport data-testid="viewport">
            {(id) => <span data-testid={`content-${id}`}>{id}</span>}
          </Tabs.Viewport>
        </Tabs.Popup>
      </Tabs.Positioner>
    </Tabs.Portal>
  </Tabs.Root>
);

/**
 * happy-dom has no Web Animations API, so an exit finishes instantly there —
 * correct for an environment with nothing to animate, but it leaves no window
 * to observe. This stands one animation in front of the exit so the contract
 * (stay mounted, marked as leaving, until it settles) is actually assertable.
 */
const withPendingAnimation = () => {
  let settleAnimation!: () => void;
  const finished = new Promise<void>((resolve) => {
    settleAnimation = resolve;
  });
  let running = true;

  const prototype = Element.prototype as unknown as { getAnimations?: () => unknown[] };
  const original = prototype.getAnimations;
  prototype.getAnimations = () => (running ? [{ finished }] : []);

  return {
    finish: () => {
      running = false;
      settleAnimation();
    },
    restore: () => {
      prototype.getAnimations = original;
    },
  };
};

const floating = (baseElement: HTMLElement, testId: string) =>
  baseElement.querySelector<HTMLElement>(`[data-testid="${testId}"]`);

describe("the floating surface", () => {
  test("nothing is portaled while nothing is open", () => {
    const { baseElement } = render(<Dock />);
    expect(floating(baseElement, "positioner")).toBeNull();
  });

  test("opening a tab brings the surface into the document", async () => {
    const { baseElement, getByTestId } = render(<Dock />);

    act(() => void fireEvent.click(getByTestId("tab-a")));
    await settle();

    const positioner = floating(baseElement, "positioner");
    expect(positioner).toBeTruthy();
    expect(positioner?.hasAttribute("data-open")).toBe(true);
    expect(positioner?.getAttribute("role")).toBe("presentation");
  });

  test("the viewport shows whichever tab is open", async () => {
    const { baseElement, getByTestId } = render(<Dock />);

    act(() => void fireEvent.click(getByTestId("tab-a")));
    await settle();
    expect(floating(baseElement, "content-a")?.parentElement).toBe(
      floating(baseElement, "viewport"),
    );

    act(() => void fireEvent.click(getByTestId("tab-b")));
    await settle();
    // Same box, different children — nothing mounted or unmounted around it.
    expect(floating(baseElement, "content-b")).toBeTruthy();
    expect(floating(baseElement, "content-a")).toBeNull();
  });

  test("stays hidden until it has actually been positioned", async () => {
    const { baseElement, getByTestId } = render(<Dock />);

    act(() => void fireEvent.click(getByTestId("tab-a")));

    // Measuring the anchor takes a frame; showing the surface at 0,0 first
    // would flash it in the corner and then jump.
    expect(floating(baseElement, "positioner")?.style.visibility).toBe("hidden");

    await settle();
    expect(floating(baseElement, "positioner")?.style.visibility).toBe("");
  });

  test("anchors to the whole item, not just the tab's button", async () => {
    const { getByTestId } = render(<Dock />);
    act(() => void fireEvent.click(getByTestId("tab-a")));
    await settle();

    const item = getByTestId("tab-a").closest("[data-tabs-trigger]");
    // Lining up with the button alone would leave the panel short by exactly
    // the width of the close button.
    expect(item).toBeTruthy();
    expect(item?.contains(getByTestId("close-a"))).toBe(true);
  });

  test("withholds a position until it has one, so it lands rather than slides", async () => {
    const { baseElement, getByTestId } = render(<Dock />);

    act(() => void fireEvent.click(getByTestId("tab-a")));

    // Before it has been measured: no coordinates at all. Writing 0,0 here is
    // what would make a consumer's `transition: top` slide it in from the
    // corner — going from `auto` to a length cannot be interpolated, so it
    // simply lands.
    const before = floating(baseElement, "positioner");
    expect(before?.style.top).toBe("");
    expect(before?.style.left).toBe("");
    expect(before?.style.visibility).toBe("hidden");

    await settle();

    const after = floating(baseElement, "positioner");
    expect(after?.style.top).not.toBe("");
    expect(after?.style.visibility).toBe("");
  });

  test("positions with top/left, so the move is a transition CSS can own", async () => {
    const { baseElement, getByTestId } = render(<Dock />);
    act(() => void fireEvent.click(getByTestId("tab-a")));
    await settle();

    const positioner = floating(baseElement, "positioner");
    expect(positioner?.style.position).toBe("absolute");
    // A transform would collide with whatever the popup inside is animating.
    expect(positioner?.style.transform).toBe("");
  });

  test("the positioner reports the side it settled on", async () => {
    const { baseElement, getByTestId } = render(<Dock />);

    act(() => void fireEvent.click(getByTestId("tab-a")));
    await settle();

    // Positioning is the positioner's; styling is the popup's — so the side is
    // published for CSS rather than acted on here.
    expect(floating(baseElement, "positioner")?.hasAttribute("data-side")).toBe(true);
    expect(floating(baseElement, "positioner")?.hasAttribute("data-align")).toBe(true);
  });

  test("keepMounted holds the surface open-less in the DOM", () => {
    const { baseElement } = render(
      <Tabs.Root defaultItems={["a"]} defaultValue={null}>
        <Strip />
        <Tabs.Portal keepMounted>
          <Tabs.Positioner data-testid="positioner">
            <Tabs.Popup data-testid="popup">
              <Tabs.Viewport />
            </Tabs.Popup>
          </Tabs.Positioner>
        </Tabs.Portal>
      </Tabs.Root>,
    );

    expect(floating(baseElement, "positioner")?.hasAttribute("data-closed")).toBe(true);
    expect(floating(baseElement, "popup")?.hasAttribute("data-closed")).toBe(true);
  });

  test("the surface stays through its exit animation, then goes", async () => {
    const animation = withPendingAnimation();
    try {
      const { baseElement, getByTestId } = render(<Dock />);

      act(() => void fireEvent.click(getByTestId("tab-a")));
      await settle();

      act(() => void fireEvent.keyDown(window, { key: "Escape" }));
      await settle();

      // Still in the document and marked as leaving — the window a stylesheet
      // gets to animate in.
      const popup = floating(baseElement, "popup");
      expect(popup).toBeTruthy();
      expect(popup?.hasAttribute("data-closed")).toBe(true);
      expect(popup?.hasAttribute("data-ending-style")).toBe(true);

      await act(async () => {
        animation.finish();
        await wait();
      });
      expect(floating(baseElement, "popup")).toBeNull();
    } finally {
      animation.restore();
    }
  });

  test("closing the open tab takes the surface away again", async () => {
    const { baseElement, getByTestId } = render(<Dock />);

    act(() => void fireEvent.click(getByTestId("tab-a")));
    await settle();
    expect(floating(baseElement, "positioner")).toBeTruthy();

    act(() => void fireEvent.click(getByTestId("close-a")));
    await settle();
    expect(floating(baseElement, "positioner")).toBeNull();
  });
});

describe("dismissal", () => {
  test("Escape closes whatever is open", async () => {
    const { getByTestId } = render(<Dock />);

    act(() => void fireEvent.click(getByTestId("tab-a")));
    await settle();

    act(() => void fireEvent.keyDown(window, { key: "Escape" }));
    expect(getByTestId("tab-a").getAttribute("aria-expanded")).toBe("false");
  });

  test("an outside press deliberately does not — this is a surface you work behind", async () => {
    const { getByTestId } = render(<Dock />);

    act(() => void fireEvent.click(getByTestId("tab-a")));
    await settle();

    act(() => void fireEvent.pointerDown(document.body));
    act(() => void fireEvent.click(document.body));

    expect(getByTestId("tab-a").getAttribute("aria-expanded")).toBe("true");
  });

  test("dismissOnEscape={false} hands the key back to the app", async () => {
    const { getByTestId } = render(<Dock dismissOnEscape={false} />);

    act(() => void fireEvent.click(getByTestId("tab-a")));
    await settle();

    act(() => void fireEvent.keyDown(window, { key: "Escape" }));
    expect(getByTestId("tab-a").getAttribute("aria-expanded")).toBe("true");
  });
});
