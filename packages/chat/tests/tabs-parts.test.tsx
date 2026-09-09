import { describe, expect, test } from "bun:test";
import { act, fireEvent, render } from "@testing-library/react";
import { Tabs, useTabs } from "../src/tabs";

const wait = (ms = 20) => new Promise((resolve) => setTimeout(resolve, ms));
/** Panels unmount only once their exit animation settles, which takes a frame. */
const settle = () => act(() => wait());

type CollectionProps = Omit<Parameters<typeof Tabs.Root>[0], "children"> & {
  ids?: string[];
};

/** Tabs come from the store, the way a consumer would render them — closing one
 *  has to actually remove it from the DOM for these tests to mean anything. */
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

const Collection = ({ ids = ["a", "b", "c"], ...root }: CollectionProps) => (
  <Tabs.Root defaultItems={ids} defaultValue="a" {...root}>
    <Strip />
    <Tabs.Viewport data-testid="viewport">
      {(id) => <span data-testid={`content-${id}`}>{id}</span>}
    </Tabs.Viewport>
  </Tabs.Root>
);

describe("structure", () => {
  test("the strip is a toolbar of buttons", () => {
    const { getByTestId, getAllByRole } = render(<Collection selectOnClose="adjacent" />);

    expect(getByTestId("list").getAttribute("role")).toBe("toolbar");
    expect(getAllByRole("button", { name: /^[abc]$/ })).toHaveLength(3);
    // A toolbar constrains nothing about what it owns, which is exactly why a
    // tab and its close button can be siblings inside a wrapper.
    expect(getByTestId("list").querySelectorAll("[data-tabs-trigger]")).toHaveLength(3);
  });

  test("one box shows whichever tab is open", () => {
    const { getByTestId, queryByTestId } = render(<Collection selectOnClose="adjacent" />);

    expect(getByTestId("content-a")).toBeTruthy();
    // No element per tab: nothing off-screen exists at all.
    expect(queryByTestId("content-b")).toBeNull();
    expect(getByTestId("viewport").querySelectorAll("[data-testid^=content-]")).toHaveLength(1);
  });

  test("parts outside a Root throw rather than reading from nowhere", () => {
    expect(() => render(<Tabs.List />)).toThrow("Tabs parts must be used within <Tabs.Root>");
  });
});

describe("selection", () => {
  test("clicking a tab swaps the content in place", async () => {
    const { getByTestId, queryByTestId } = render(<Collection selectOnClose="adjacent" />);
    const viewport = getByTestId("viewport");

    act(() => void fireEvent.click(getByTestId("tab-b")));
    await settle();

    expect(getByTestId("tab-b").getAttribute("aria-expanded")).toBe("true");
    expect(getByTestId("content-b")).toBeTruthy();
    expect(queryByTestId("content-a")).toBeNull();
    // Same element throughout — it never unmounted.
    expect(getByTestId("viewport")).toBe(viewport);
  });

  test("the open tab and the viewport point at each other", () => {
    const { getByTestId } = render(<Collection selectOnClose="adjacent" />);

    expect(getByTestId("tab-a").getAttribute("aria-controls")).toBe(getByTestId("viewport").id);
    expect(getByTestId("viewport").getAttribute("aria-labelledby")).toBe(getByTestId("tab-a").id);
  });

  test("with no viewport rendered, a tab claims nothing", () => {
    const { getByTestId } = render(
      <Tabs.Root defaultItems={["a"]} defaultValue="a">
        <Strip />
      </Tabs.Root>,
    );
    expect(getByTestId("tab-a").hasAttribute("aria-controls")).toBe(false);
  });

  test("nothing open means nothing rendered, and no label", async () => {
    const { getByTestId, queryByTestId } = render(<Collection />);

    act(() => void fireEvent.click(getByTestId("close-a")));
    await settle();

    expect(queryByTestId("content-a")).toBeNull();
    expect(getByTestId("viewport").hasAttribute("aria-labelledby")).toBe(false);
  });

  test("controlled: the prop wins and the store does not self-commit", () => {
    const seen: (string | null)[] = [];
    const { getByTestId } = render(
      <Collection selectOnClose="adjacent" onValueChange={(value) => seen.push(value)} value="a" />,
    );

    act(() => void fireEvent.click(getByTestId("tab-b")));

    expect(seen).toEqual(["b"]);
    expect(getByTestId("tab-a").getAttribute("aria-expanded")).toBe("true");
  });
});

describe("keyboard", () => {
  test("arrows move focus without opening anything", () => {
    const { getByTestId } = render(<Collection selectOnClose="adjacent" />);
    act(() => getByTestId("tab-a").focus());

    act(() => void fireEvent.keyDown(getByTestId("list"), { key: "ArrowRight" }));

    expect(document.activeElement).toBe(getByTestId("tab-b"));
    // Manual activation: focus moved, the open tab did not.
    expect(getByTestId("tab-a").getAttribute("aria-expanded")).toBe("true");
  });

  test("activateOnFocus opens as it goes", async () => {
    const { getByTestId } = render(<Collection selectOnClose="adjacent" activateOnFocus />);
    act(() => getByTestId("tab-a").focus());

    act(() => void fireEvent.keyDown(getByTestId("list"), { key: "ArrowRight" }));
    await settle();

    expect(getByTestId("tab-b").getAttribute("aria-expanded")).toBe("true");
  });

  test("the roving tabindex follows focus, so Tab enters at one place", () => {
    const { getByTestId } = render(<Collection selectOnClose="adjacent" />);

    expect(getByTestId("tab-a").tabIndex).toBe(0);
    expect(getByTestId("tab-b").tabIndex).toBe(-1);

    act(() => void fireEvent.keyDown(getByTestId("list"), { key: "ArrowRight" }));

    expect(getByTestId("tab-a").tabIndex).toBe(-1);
    expect(getByTestId("tab-b").tabIndex).toBe(0);
  });

  test("arrows wrap at the ends, unless told not to", () => {
    const { getByTestId, rerender } = render(<Collection selectOnClose="adjacent" />);

    act(() => void fireEvent.keyDown(getByTestId("list"), { key: "ArrowLeft" }));
    expect(document.activeElement).toBe(getByTestId("tab-c"));

    rerender(<Collection selectOnClose="adjacent" loop={false} />);
    act(() => getByTestId("tab-a").focus());
    act(() => void fireEvent.keyDown(getByTestId("list"), { key: "ArrowLeft" }));
    expect(document.activeElement).toBe(getByTestId("tab-a"));
  });

  test("Home and End jump to the ends", () => {
    const { getByTestId } = render(<Collection selectOnClose="adjacent" />);

    act(() => void fireEvent.keyDown(getByTestId("list"), { key: "End" }));
    expect(document.activeElement).toBe(getByTestId("tab-c"));

    act(() => void fireEvent.keyDown(getByTestId("list"), { key: "Home" }));
    expect(document.activeElement).toBe(getByTestId("tab-a"));
  });

  test("a vertical list walks with Up and Down", () => {
    const { getByTestId } = render(<Collection selectOnClose="adjacent" orientation="vertical" />);

    expect(getByTestId("list").getAttribute("aria-orientation")).toBe("vertical");
    act(() => void fireEvent.keyDown(getByTestId("list"), { key: "ArrowDown" }));
    expect(document.activeElement).toBe(getByTestId("tab-b"));
  });

  test("keys the list does not own are left alone", () => {
    const { getByTestId } = render(<Collection selectOnClose="adjacent" />);
    act(() => getByTestId("tab-a").focus());

    act(() => void fireEvent.keyDown(getByTestId("list"), { key: "ArrowDown" }));
    expect(document.activeElement).toBe(getByTestId("tab-a"));
  });
});

describe("activation direction", () => {
  /**
   * happy-dom has no layout, so every rect is zero and the measured path can
   * never distinguish two tabs. This stands in a layout where each item sits
   * 100px right of the last, which is what the real path reads.
   */
  const withLayout = () => {
    const prototype = Element.prototype;
    const original = prototype.getBoundingClientRect;

    prototype.getBoundingClientRect = function boundingRect(this: Element) {
      const items = Array.from(document.querySelectorAll("[data-tabs-trigger]"));
      const index = items.indexOf(this);
      const left = index === -1 ? 0 : index * 100;
      return { left, top: 0, width: 90, height: 30 } as DOMRect;
    };

    return () => {
      prototype.getBoundingClientRect = original;
    };
  };

  test("is published as data-activation-direction, measured off the tabs", async () => {
    const restore = withLayout();
    try {
      const { getByTestId } = render(<Collection selectOnClose="adjacent" />);

      act(() => void fireEvent.click(getByTestId("tab-c")));
      await settle();
      expect(getByTestId("viewport").getAttribute("data-activation-direction")).toBe("right");

      act(() => void fireEvent.click(getByTestId("tab-a")));
      await settle();
      expect(getByTestId("viewport").getAttribute("data-activation-direction")).toBe("left");
    } finally {
      restore();
    }
  });

  test("every part carries it, so any of them can drive the motion", async () => {
    const restore = withLayout();
    try {
      const { getByTestId } = render(<Collection selectOnClose="adjacent" />);
      act(() => void fireEvent.click(getByTestId("tab-b")));
      await settle();

      expect(getByTestId("list").getAttribute("data-activation-direction")).toBe("right");
      expect(getByTestId("viewport").getAttribute("data-activation-direction")).toBe("right");
    } finally {
      restore();
    }
  });

  test("no direction means no attribute at all", () => {
    const { getByTestId } = render(<Collection selectOnClose="adjacent" />);
    expect(getByTestId("list").hasAttribute("data-activation-direction")).toBe(false);
  });
});

describe("closing", () => {
  test("the close button removes the tab and hands over to its neighbour", async () => {
    const { getByTestId, queryByTestId } = render(<Collection selectOnClose="adjacent" />);

    act(() => void fireEvent.click(getByTestId("close-a")));
    await settle();

    expect(queryByTestId("tab-a")).toBeNull();
    expect(getByTestId("tab-b").getAttribute("aria-expanded")).toBe("true");
  });

  test("focus lands on the tab that took over, not on the body", async () => {
    const { getByTestId } = render(<Collection selectOnClose="adjacent" />);

    act(() => void fireEvent.click(getByTestId("close-a")));
    await settle();

    expect(document.activeElement).toBe(getByTestId("tab-b"));
  });

  test("Delete on a tab closes it, so the pointer is not the only way", async () => {
    const { getByTestId, queryByTestId } = render(<Collection selectOnClose="adjacent" />);

    act(() => void fireEvent.keyDown(getByTestId("tab-a"), { key: "Delete" }));
    await settle();

    expect(queryByTestId("tab-a")).toBeNull();
  });

  test("closing the last tab leaves nothing open", async () => {
    const { queryByTestId, getByTestId } = render(
      <Collection selectOnClose="adjacent" ids={["a"]} />,
    );

    act(() => void fireEvent.click(getByTestId("close-a")));
    await settle();

    expect(queryByTestId("tab-a")).toBeNull();
    expect(queryByTestId("panel-a")).toBeNull();
    expect(getByTestId("list").getAttribute("data-empty")).toBe("");
  });

  test("the close button stays out of the roving order", () => {
    const { getByTestId } = render(<Collection selectOnClose="adjacent" />);
    expect(getByTestId("close-a").tabIndex).toBe(-1);
  });

  test("with selectOnClose unset, a close shows nothing", async () => {
    const { getByTestId, queryByTestId } = render(<Collection />);

    act(() => void fireEvent.click(getByTestId("close-a")));
    await settle();

    expect(queryByTestId("panel-b")).toBeNull();
    expect(getByTestId("list").getAttribute("data-empty")).toBe("");
  });
});
describe("Tabs.Trigger — content with no tab behind it", () => {
  /** A "new chat" button: shows a draft, and only commits on send. */
  const Draft = () => {
    const items = useTabs((tabs) => tabs.items);
    const open = useTabs((tabs) => tabs.open);

    return (
      <>
        <Tabs.List data-testid="list">
          {items.map((id) => (
            <Tabs.Trigger key={id} value={id} data-testid={`tab-${id}`}>
              {id}
            </Tabs.Trigger>
          ))}
        </Tabs.List>

        <Tabs.Trigger data-testid="new" value="draft">
          New
        </Tabs.Trigger>

        <Tabs.Viewport data-testid="viewport">
          {(value) =>
            value === "draft" ? (
              <button data-testid="send" onClick={() => open("sent")} type="button">
                Send
              </button>
            ) : (
              <span data-testid={`content-${value}`}>{value}</span>
            )
          }
        </Tabs.Viewport>
      </>
    );
  };

  const draft = () =>
    render(
      <Tabs.Root defaultItems={["a"]} defaultValue={null}>
        <Draft />
      </Tabs.Root>,
    );

  test("shows its content without joining the collection", async () => {
    const { getByTestId, queryByTestId } = draft();

    act(() => void fireEvent.click(getByTestId("new")));
    await settle();

    expect(getByTestId("send")).toBeTruthy();
    expect(getByTestId("new").getAttribute("aria-expanded")).toBe("true");
    // No tab appeared: the collection is untouched.
    expect(queryByTestId("tab-draft")).toBeNull();
    expect(getByTestId("list").querySelectorAll("[data-tabs-trigger]")).toHaveLength(1);
  });

  test("is the anchor for the surface it opens", async () => {
    const { getByTestId } = draft();
    act(() => void fireEvent.click(getByTestId("new")));
    await settle();

    expect(getByTestId("new").getAttribute("aria-controls")).toBe(getByTestId("viewport").id);
  });

  test("clicking it again dismisses the draft — there is no tab to close", async () => {
    const { getByTestId, queryByTestId } = draft();

    act(() => void fireEvent.click(getByTestId("new")));
    await settle();
    act(() => void fireEvent.click(getByTestId("new")));
    await settle();

    expect(queryByTestId("send")).toBeNull();
    expect(getByTestId("new").getAttribute("aria-expanded")).toBe("false");
  });

  test("sending commits it to a real tab and the draft goes away", async () => {
    const { getByTestId, queryByTestId } = draft();

    act(() => void fireEvent.click(getByTestId("new")));
    await settle();

    act(() => void fireEvent.click(getByTestId("send")));
    await settle();

    // The committed chat is now a tab, open, and the draft is gone.
    expect(getByTestId("tab-sent")).toBeTruthy();
    expect(getByTestId("tab-sent").getAttribute("aria-expanded")).toBe("true");
    expect(queryByTestId("send")).toBeNull();
    expect(getByTestId("new").getAttribute("aria-expanded")).toBe("false");
  });

  test("opening a real tab dismisses a draft that was showing", async () => {
    const { getByTestId } = draft();

    act(() => void fireEvent.click(getByTestId("new")));
    await settle();
    act(() => void fireEvent.click(getByTestId("tab-a")));
    await settle();

    expect(getByTestId("new").getAttribute("aria-expanded")).toBe("false");
    expect(getByTestId("content-a")).toBeTruthy();
  });
});

describe("a text field inside the strip", () => {
  /** Renaming a tab in place — loredex does this on double-click. */
  const Renaming = () => (
    <Tabs.Root defaultItems={["a", "b"]} defaultValue="a">
      <Tabs.List data-testid="list">
        <Tabs.Trigger value="a">
          <input data-testid="rename" defaultValue="README" />
        </Tabs.Trigger>
        <Tabs.Trigger value="b" data-testid="tab-b">
          b
        </Tabs.Trigger>
      </Tabs.List>
    </Tabs.Root>
  );

  const caretAt = (input: HTMLInputElement, position: number) => {
    input.focus();
    input.setSelectionRange(position, position);
  };

  test("keeps the arrow key while the caret still has somewhere to go", () => {
    const { getByTestId } = render(<Renaming />);
    const input = getByTestId("rename") as HTMLInputElement;

    act(() => caretAt(input, 2));
    act(() => void fireEvent.keyDown(input, { key: "ArrowRight" }));

    // The caret's, not the roving focus's.
    expect(document.activeElement).toBe(input);
  });

  test("hands it back once the caret is at the end", () => {
    const { getByTestId } = render(<Renaming />);
    const input = getByTestId("rename") as HTMLInputElement;

    act(() => caretAt(input, input.value.length));
    act(() => void fireEvent.keyDown(input, { key: "ArrowRight" }));

    expect(document.activeElement).toBe(getByTestId("tab-b"));
  });

  test("a Shift-selection is always the field's", () => {
    const { getByTestId } = render(<Renaming />);
    const input = getByTestId("rename") as HTMLInputElement;

    act(() => caretAt(input, input.value.length));
    act(() => void fireEvent.keyDown(input, { key: "ArrowRight", shiftKey: true }));

    expect(document.activeElement).toBe(input);
  });
});

describe("disabled", () => {
  const Disabled = ({ root = false }: { root?: boolean }) => {
    const items = useTabs((tabs) => tabs.items);

    return (
      <Tabs.List data-testid="list">
        {items.map((id) => (
          <Tabs.Trigger
            data-testid={`tab-${id}`}
            disabled={!root && id === "b"}
            key={id}
            value={id}
          >
            {id}
            <Tabs.Close aria-label={`Close ${id}`} data-testid={`close-${id}`} />
          </Tabs.Trigger>
        ))}
      </Tabs.List>
    );
  };

  const collection = (root = false) =>
    render(
      <Tabs.Root
        defaultItems={["a", "b", "c"]}
        defaultValue="a"
        disabled={root}
        selectOnClose="adjacent"
      >
        <Disabled root={root} />
      </Tabs.Root>,
    );

  test("says so without taking itself out of the tab order", () => {
    const { getByTestId } = collection();
    const tab = getByTestId("tab-b");

    expect(tab.getAttribute("aria-disabled")).toBe("true");
    // Still in the roving order, so you can discover the tab exists — which is
    // what the APG asks a toolbar to avoid hiding.
    expect(tab.hasAttribute("data-disabled")).toBe(true);
    expect(tab.getAttribute("tabindex")).not.toBeNull();
  });

  test("cannot be opened by pointer or by arrowing onto it", async () => {
    const { getByTestId } = collection();

    act(() => void fireEvent.click(getByTestId("tab-b")));
    await settle();
    expect(getByTestId("tab-b").getAttribute("aria-expanded")).toBe("false");

    act(() => void fireEvent.keyDown(getByTestId("list"), { key: "ArrowRight" }));
    // Still reachable — focus moved there — but not open.
    expect(document.activeElement).toBe(getByTestId("tab-b"));
    expect(getByTestId("tab-b").getAttribute("aria-expanded")).toBe("false");
  });

  test("cannot be closed either", async () => {
    const { getByTestId } = collection();

    act(() => void fireEvent.click(getByTestId("close-b")));
    await settle();
    expect(getByTestId("tab-b")).toBeTruthy();
  });

  test("a close hands over to the nearest tab that can take it", async () => {
    const { getByTestId } = collection();

    // "a" closes, its neighbour "b" is disabled, so "c" takes over.
    act(() => void fireEvent.click(getByTestId("close-a")));
    await settle();
    expect(getByTestId("tab-c").getAttribute("aria-expanded")).toBe("true");
  });

  test("the Root disables the whole collection at once", () => {
    const { getByTestId } = collection(true);

    for (const id of ["a", "b", "c"]) {
      expect(getByTestId(`tab-${id}`).getAttribute("aria-disabled")).toBe("true");
    }
  });
});

describe("Tabs.List, given a function", () => {
  const listed = () =>
    render(
      <Tabs.Root defaultItems={["a", "b", "c"]} defaultValue="a" selectOnClose="adjacent">
        <Tabs.List data-testid="list">
          {(value, index) => (
            <Tabs.Trigger value={value} data-testid={`tab-${value}`}>
              {`${index}:${value}`}
              <Tabs.Close aria-label={`Close ${value}`} data-testid={`close-${value}`} />
            </Tabs.Trigger>
          )}
        </Tabs.List>
        <Tabs.Viewport data-testid="viewport">
          {(value) => <span data-testid={`content-${value}`}>{value}</span>}
        </Tabs.Viewport>
      </Tabs.Root>,
    );

  test("renders one call per tab, in order, and hands over the index", () => {
    const { getByTestId } = listed();

    expect(getByTestId("list").querySelectorAll("[data-tabs-trigger]")).toHaveLength(3);
    expect(getByTestId("tab-a").textContent).toBe("0:a");
    expect(getByTestId("tab-c").textContent).toBe("2:c");
  });

  test("keys the tabs itself, so closing one leaves the rest alone", async () => {
    const { getByTestId, queryByTestId } = listed();

    act(() => void fireEvent.click(getByTestId("close-a")));
    await settle();

    expect(queryByTestId("tab-a")).toBeNull();
    expect(getByTestId("tab-b").textContent).toBe("0:b");
    expect(getByTestId("content-b")).toBeTruthy();
  });

  test("plain children still work, for a strip you lay out yourself", () => {
    const { getByTestId } = render(
      <Tabs.Root defaultItems={["a"]} defaultValue="a">
        <Tabs.List data-testid="list">
          <Tabs.Trigger value="a" data-testid="tab-a">
            a
          </Tabs.Trigger>
          <button data-testid="add" type="button">
            +
          </button>
        </Tabs.List>
      </Tabs.Root>,
    );

    expect(getByTestId("tab-a")).toBeTruthy();
    expect(getByTestId("add")).toBeTruthy();
  });
});

describe("Tabs.Action", () => {
  const WithAction = () => (
    <Tabs.Root defaultItems={["a", "b"]} defaultValue="a">
      <Tabs.List>
        {(id) => (
          <Tabs.Trigger key={id} value={id} data-testid={`tab-${id}`}>
            {id}
            <Tabs.Action data-testid={`action-${id}`}>
              <Tabs.Close aria-label={`Close ${id}`} data-testid={`close-${id}`} />
            </Tabs.Action>
          </Tabs.Trigger>
        )}
      </Tabs.List>
    </Tabs.Root>
  );

  test("carries the tab's selected state, so the fade can match its colour", () => {
    // The slot's whole job is to end a gradient in whatever colour the tab
    // currently is, which it cannot do without knowing whether it is selected.
    const { getByTestId } = render(<WithAction />);

    expect(getByTestId("action-a").hasAttribute("data-selected")).toBe(true);
    expect(getByTestId("action-b").hasAttribute("data-selected")).toBe(false);

    fireEvent.click(getByTestId("tab-b"));
    expect(getByTestId("action-a").hasAttribute("data-selected")).toBe(false);
    expect(getByTestId("action-b").hasAttribute("data-selected")).toBe(true);
  });

  test("it is a slot, not a control — the close inside it still closes", () => {
    const { getByTestId, queryByTestId } = render(<WithAction />);

    fireEvent.click(getByTestId("close-b"));
    expect(queryByTestId("tab-b")).toBeNull();
    expect(getByTestId("tab-a")).toBeTruthy();
  });

  test("the slot is visual, not an interaction boundary", () => {
    /*
     * It overlays the right end of the pill, and the whole pill is the click
     * target — that is the reason a tab is not a real button in the first
     * place. So a press on the slot's padding selects the tab like a press
     * anywhere else, and only the close button inside it does not.
     */
    const { getByTestId } = render(<WithAction />);

    fireEvent.click(getByTestId("action-b"));
    expect(getByTestId("tab-b").getAttribute("aria-expanded")).toBe("true");
  });
});
