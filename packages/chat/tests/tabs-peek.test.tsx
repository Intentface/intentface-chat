import { describe, expect, mock, test } from "bun:test";
import { act, fireEvent, render } from "@testing-library/react";
import { useState } from "react";
import { createPortal } from "react-dom";
import { Tabs } from "../src/tabs";
import { createTabsStore } from "../src/tabs/store";

const wait = (ms = 20) => new Promise((resolve) => setTimeout(resolve, ms));
const settle = (ms?: number) => act(() => wait(ms));

/** Short delays, so the choreography runs in real time without slowing the suite. */
const OPEN = 30;
const CLOSE = 30;

// ---------------------------------------------------------------------------
// The store
// ---------------------------------------------------------------------------

const seeded = () => {
  const store = createTabsStore();
  store.hydrate({ items: ["page", "chat", "other"], value: "page" });
  return store;
};

describe("the peek channel", () => {
  test("a tab can float without being selected", () => {
    const store = seeded();
    store.getSnapshot().setPeek("chat");

    expect(store.getSnapshot().peek).toBe("chat");
    expect(store.getSnapshot().value).toBe("page");
  });

  test("the selected tab is already showing, so it cannot be peeked", () => {
    const store = seeded();
    store.getSnapshot().setPeek("page");
    expect(store.getSnapshot().peek).toBeNull();
  });

  test("a disabled tab cannot be peeked", () => {
    const store = seeded();
    store.registerDisabled("chat", true);
    store.getSnapshot().setPeek("chat");
    expect(store.getSnapshot().peek).toBeNull();
  });

  test("selecting the peeked tab opens it for real, and ends the peek first", () => {
    const store = seeded();
    const seen: string[] = [];
    store.onPeekChangeRef.current = (peek) => void seen.push(`peek:${peek}`);
    store.onValueChangeRef.current = (value) => void seen.push(`value:${value}`);

    store.getSnapshot().setPeek("chat");
    store.getSnapshot().select("chat");

    expect(store.getSnapshot().peek).toBeNull();
    expect(store.getSnapshot().value).toBe("chat");
    // Never both at once, from a listener's point of view.
    expect(seen).toEqual(["peek:chat", "peek:null", "value:chat"]);
  });

  test("selecting something else leaves the peek where it is", () => {
    const store = seeded();
    store.getSnapshot().setPeek("chat");
    store.getSnapshot().select("other");
    expect(store.getSnapshot().peek).toBe("chat");
  });

  test("closing the peeked tab ends the peek", () => {
    const store = seeded();
    store.getSnapshot().setPeek("chat");
    store.getSnapshot().close("chat");
    expect(store.getSnapshot().peek).toBeNull();
  });

  test("controlled: the change is reported and nothing self-commits", () => {
    const store = seeded();
    const seen: (string | null)[] = [];
    store.peekControlledRef.current = true;
    store.onPeekChangeRef.current = (peek) => void seen.push(peek);

    store.getSnapshot().setPeek("chat");

    expect(seen).toEqual(["chat"]);
    expect(store.getSnapshot().peek).toBeNull();
  });

  test("a restored peek at the selected tab is dropped", () => {
    const store = createTabsStore();
    store.hydrate({ items: ["page", "chat"], value: "chat", peek: "chat" });
    expect(store.getSnapshot().peek).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// The surface and its choreography
// ---------------------------------------------------------------------------

type PageProps = Omit<Parameters<typeof Tabs.Root>[0], "children"> & {
  /** Rendered inside the peek, portaled out of it — a menu, say. */
  withPortaledChild?: boolean;
};

/**
 * A page strip: `page` in the layout, never null; `chat` and `other` peek on
 * hover. The shape the peek channel exists for.
 */
const Page = ({ withPortaledChild, ...root }: PageProps) => (
  <Tabs.Root
    defaultItems={["page", "chat", "other"]}
    defaultValue="page"
    dismissOnEscape={false}
    peekDelay={OPEN}
    peekCloseDelay={CLOSE}
    {...root}
  >
    <Tabs.List>
      {(id) => (
        <Tabs.Trigger value={id} peekOnHover={id !== "page"} data-testid={`tab-${id}`}>
          {id}
        </Tabs.Trigger>
      )}
    </Tabs.List>
    <Tabs.Viewport data-testid="layout">{(id) => <span>{`layout:${id}`}</span>}</Tabs.Viewport>
    <Tabs.Portal peek>
      <Tabs.Positioner side="bottom">
        <Tabs.Popup data-testid="peek">
          <Tabs.Viewport data-testid="peek-viewport">
            {(id) => (
              <div>
                <span data-testid="peek-content">{`peek:${id}`}</span>
                <input data-testid="peek-input" aria-label="Reply" />
                {withPortaledChild && <PortaledMenu />}
              </div>
            )}
          </Tabs.Viewport>
        </Tabs.Popup>
      </Tabs.Positioner>
    </Tabs.Portal>
  </Tabs.Root>
);

/** Inside the peek as far as React is concerned, elsewhere in the DOM. */
const PortaledMenu = () => {
  const [host] = useState(() => {
    const element = document.createElement("div");
    document.body.append(element);
    return element;
  });
  return createPortal(
    <button type="button" data-testid="menu-item">
      Item
    </button>,
    host,
  );
};

const q = (baseElement: HTMLElement, testId: string) =>
  baseElement.querySelector<HTMLElement>(`[data-testid="${testId}"]`);

const hover = (element: HTMLElement, pointerType = "mouse") =>
  act(() => void fireEvent.pointerEnter(element, { pointerType }));
const unhover = (element: HTMLElement, pointerType = "mouse") =>
  act(() => void fireEvent.pointerLeave(element, { pointerType }));

/** Hover a tab and wait out the open delay. */
const peekAt = async (baseElement: HTMLElement, id: string) => {
  hover(q(baseElement, `tab-${id}`) as HTMLElement);
  await settle(OPEN + 20);
};

describe("hovering to peek", () => {
  test("resting on a tab floats it, and the page underneath stays selected", async () => {
    const { baseElement } = render(<Page />);
    await peekAt(baseElement, "chat");

    expect(q(baseElement, "peek-content")?.textContent).toBe("peek:chat");
    expect(q(baseElement, "layout")?.textContent).toBe("layout:page");
    expect(q(baseElement, "tab-chat")?.hasAttribute("data-peeked")).toBe(true);
    // A peek changes nothing about the selection, so nothing about the disclosure.
    expect(q(baseElement, "tab-chat")?.getAttribute("aria-expanded")).toBe("false");
  });

  test("passing over a tab on the way somewhere else opens nothing", async () => {
    const { baseElement } = render(<Page />);
    const chat = q(baseElement, "tab-chat") as HTMLElement;

    hover(chat);
    await settle(OPEN / 3);
    unhover(chat);
    await settle(OPEN + 20);

    expect(q(baseElement, "peek")).toBeNull();
  });

  test("a touch or a pen is not a hover", async () => {
    const { baseElement } = render(<Page />);
    hover(q(baseElement, "tab-chat") as HTMLElement, "touch");
    hover(q(baseElement, "tab-other") as HTMLElement, "pen");
    await settle(OPEN + 20);

    expect(q(baseElement, "peek")).toBeNull();
  });

  test("the selected tab never peeks — it is already showing", async () => {
    const { baseElement } = render(<Page defaultValue="chat" />);
    await peekAt(baseElement, "chat");
    expect(q(baseElement, "peek")).toBeNull();
  });

  test("a tab that did not opt in does not peek", async () => {
    const { baseElement } = render(<Page defaultValue="other" />);
    await peekAt(baseElement, "page");
    expect(q(baseElement, "peek")).toBeNull();
  });

  test("leaving closes it after the delay, unless the pointer reaches the surface", async () => {
    const { baseElement } = render(<Page />);
    await peekAt(baseElement, "chat");

    unhover(q(baseElement, "tab-chat") as HTMLElement);
    hover(q(baseElement, "peek") as HTMLElement);
    await settle(CLOSE + 20);
    expect(q(baseElement, "peek-content")).toBeTruthy();

    unhover(q(baseElement, "peek") as HTMLElement);
    await settle(CLOSE + 40);
    expect(q(baseElement, "peek")).toBeNull();
  });

  test("once open, resting on another tab switches straight away", async () => {
    const { baseElement } = render(<Page />);
    await peekAt(baseElement, "chat");

    unhover(q(baseElement, "tab-chat") as HTMLElement);
    hover(q(baseElement, "tab-other") as HTMLElement);

    // Asserted before any wait: the switch is immediate, not delayed.
    expect(q(baseElement, "peek-content")?.textContent).toBe("peek:other");
    // Let the positioner re-anchor to the new tab before the test ends.
    await settle();
  });
});

describe("an engaged peek", () => {
  test("a press inside keeps it, however far the pointer wanders", async () => {
    const { baseElement } = render(<Page />);
    await peekAt(baseElement, "chat");
    const surface = q(baseElement, "peek") as HTMLElement;

    hover(surface);
    act(() => void fireEvent.pointerDown(q(baseElement, "peek-content") as HTMLElement));
    unhover(surface);
    await settle(CLOSE + 40);

    expect(q(baseElement, "peek-content")).toBeTruthy();
  });

  test("so does focus inside — typing is using it", async () => {
    const { baseElement } = render(<Page />);
    await peekAt(baseElement, "chat");

    act(() => (q(baseElement, "peek-input") as HTMLElement).focus());
    unhover(q(baseElement, "tab-chat") as HTMLElement);
    await settle(CLOSE + 40);

    expect(q(baseElement, "peek-content")).toBeTruthy();
  });

  test("and passing over another tab does not take it away", async () => {
    const { baseElement } = render(<Page />);
    await peekAt(baseElement, "chat");
    act(() => (q(baseElement, "peek-input") as HTMLElement).focus());

    await peekAt(baseElement, "other");

    expect(q(baseElement, "peek-content")?.textContent).toBe("peek:chat");
  });
});

describe("ending a peek", () => {
  test("Escape ends the peek and leaves the page selected", async () => {
    const onValueChange = mock();
    const { baseElement } = render(<Page onValueChange={onValueChange} />);
    await peekAt(baseElement, "chat");

    act(() => void fireEvent.keyDown(window, { key: "Escape" }));
    await settle();

    expect(q(baseElement, "peek")).toBeNull();
    expect(onValueChange).not.toHaveBeenCalled();
  });

  test("an Escape something inside already spent is left alone", async () => {
    const { baseElement } = render(<Page />);
    await peekAt(baseElement, "chat");
    const input = q(baseElement, "peek-input") as HTMLElement;
    input.addEventListener("keydown", (event) => event.preventDefault());

    act(() => void fireEvent.keyDown(input, { key: "Escape" }));

    expect(q(baseElement, "peek-content")).toBeTruthy();
  });

  test("a press outside ends it — even an engaged one", async () => {
    const { baseElement } = render(<Page />);
    await peekAt(baseElement, "chat");
    act(() => (q(baseElement, "peek-input") as HTMLElement).focus());

    act(() => void fireEvent.pointerDown(document.body));
    await settle();

    expect(q(baseElement, "peek")).toBeNull();
  });

  test("a press in something the peek portaled elsewhere is still inside", async () => {
    const { baseElement } = render(<Page withPortaledChild />);
    await peekAt(baseElement, "chat");

    act(() => void fireEvent.pointerDown(q(baseElement, "menu-item") as HTMLElement));
    await settle();

    expect(q(baseElement, "peek-content")).toBeTruthy();
  });

  test("pressing the peeked tab opens it for real", async () => {
    const { baseElement } = render(<Page />);
    await peekAt(baseElement, "chat");

    const chat = q(baseElement, "tab-chat") as HTMLElement;
    act(() => {
      fireEvent.pointerDown(chat);
      fireEvent.click(chat);
    });
    await settle();

    expect(q(baseElement, "peek")).toBeNull();
    expect(q(baseElement, "layout")?.textContent).toBe("layout:chat");
  });

  test("a peek opened in code is not closed by the pointer leaving", async () => {
    const store = createTabsStore();
    const { baseElement } = render(<Page store={store} />);

    act(() => store.getSnapshot().setPeek("chat"));
    hover(q(baseElement, "tab-other") as HTMLElement);
    unhover(q(baseElement, "tab-other") as HTMLElement);
    await settle(CLOSE + 40);

    expect(q(baseElement, "peek-content")?.textContent).toBe("peek:chat");
  });
});

describe("what the peek tells assistive tech", () => {
  test("triggers keep pointing at the layout viewport, not the peek", async () => {
    const { baseElement } = render(<Page />);
    await peekAt(baseElement, "chat");

    const layout = q(baseElement, "layout") as HTMLElement;
    expect(q(baseElement, "tab-chat")?.getAttribute("aria-controls")).toBe(layout.id);
  });

  test("the peek is named by the tab it is showing", async () => {
    const { baseElement } = render(<Page />);
    await peekAt(baseElement, "chat");

    const viewport = q(baseElement, "peek-viewport") as HTMLElement;
    expect(viewport.getAttribute("role")).toBe("group");
    expect(viewport.getAttribute("aria-labelledby")).toBe(
      (q(baseElement, "tab-chat") as HTMLElement).id,
    );
    expect(viewport.id).not.toBe((q(baseElement, "layout") as HTMLElement).id);
  });
});
