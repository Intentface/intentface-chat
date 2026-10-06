import { describe, expect, mock, test } from "bun:test";
import { act, fireEvent, render } from "@testing-library/react";
import { Tabs, type TabsRootChangeEventDetails } from "../src/tabs";
import { createTabsStore } from "../src/tabs/store";

type ValueChange = (value: string | null, eventDetails: TabsRootChangeEventDetails) => void;
type ItemsChange = (items: string[], eventDetails: TabsRootChangeEventDetails) => void;

const Strip = ({
  onValueChange,
  onItemsChange,
  activateOnFocus,
}: {
  onValueChange?: ValueChange;
  onItemsChange?: ItemsChange;
  activateOnFocus?: boolean;
}) => (
  <Tabs.Root
    defaultItems={["a", "b", "c"]}
    defaultValue="b"
    selectOnClose="adjacent"
    activateOnFocus={activateOnFocus}
    onValueChange={onValueChange}
    onItemsChange={onItemsChange}
  >
    <Tabs.List>
      {(id) => (
        <Tabs.Trigger value={id} data-testid={`tab-${id}`}>
          {id}
          <Tabs.Close aria-label={`Close ${id}`} data-testid={`close-${id}`} />
        </Tabs.Trigger>
      )}
    </Tabs.List>
  </Tabs.Root>
);

describe("the store", () => {
  test("an action called from code says so", () => {
    const store = createTabsStore();
    store.hydrate({ items: ["a", "b"], value: "a" });
    const onValueChange = mock<ValueChange>();
    store.onValueChangeRef.current = onValueChange;

    store.getSnapshot().select("b");

    expect(onValueChange.mock.calls[0]?.[1].reason).toBe("imperative-action");
  });

  test("cancelling the value change keeps the selection", () => {
    const store = createTabsStore();
    store.hydrate({ items: ["a", "b"], value: "a" });
    store.onValueChangeRef.current = (_, eventDetails) => eventDetails.cancel();

    store.getSnapshot().select("b");

    expect(store.getSnapshot().value).toBe("a");
  });

  test("cancelling the items change of a close keeps the tab and the selection", () => {
    const store = createTabsStore();
    store.hydrate({ items: ["a", "b"], value: "b" });
    store.selectOnCloseRef.current = "adjacent";
    const onValueChange = mock<ValueChange>();
    store.onValueChangeRef.current = onValueChange;
    store.onItemsChangeRef.current = (_, eventDetails) => eventDetails.cancel();

    store.getSnapshot().close("b");

    expect(store.getSnapshot().items).toEqual(["a", "b"]);
    expect(store.getSnapshot().value).toBe("b");
    expect(onValueChange).not.toHaveBeenCalled();
  });

  test("the selection that follows a close cannot be cancelled", () => {
    const store = createTabsStore();
    store.hydrate({ items: ["a", "b"], value: "b" });
    store.selectOnCloseRef.current = "adjacent";
    store.onValueChangeRef.current = (_, eventDetails) => eventDetails.cancel();

    store.getSnapshot().close("b");

    expect(store.getSnapshot().items).toEqual(["a"]);
    expect(store.getSnapshot().value).toBe("a");
  });

  test("a close reports one reason for both changes", () => {
    const store = createTabsStore();
    store.hydrate({ items: ["a", "b"], value: "b" });
    store.selectOnCloseRef.current = "adjacent";
    const onValueChange = mock<ValueChange>();
    const onItemsChange = mock<ItemsChange>();
    store.onValueChangeRef.current = onValueChange;
    store.onItemsChangeRef.current = onItemsChange;

    store.getSnapshot().close("b");

    expect(onItemsChange.mock.calls[0]?.[1].reason).toBe("imperative-action");
    expect(onValueChange.mock.calls[0]?.[0]).toBe("a");
    expect(onValueChange.mock.calls[0]?.[1].reason).toBe("imperative-action");
  });
});

describe("the parts", () => {
  test("pressing a tab reports the press and the tab", () => {
    const onValueChange = mock<ValueChange>();
    const { getByTestId } = render(<Strip onValueChange={onValueChange} />);

    fireEvent.click(getByTestId("tab-c"));

    const [value, eventDetails] = onValueChange.mock.calls[0] ?? [];
    expect(value).toBe("c");
    expect(eventDetails?.reason).toBe("trigger-press");
    expect(eventDetails?.trigger).toBe(getByTestId("tab-c"));
  });

  test("the close button reports a close press, and cancelling keeps the tab", () => {
    const onItemsChange = mock<ItemsChange>((_, eventDetails) => eventDetails.cancel());
    const { getByTestId } = render(<Strip onItemsChange={onItemsChange} />);

    fireEvent.click(getByTestId("close-b"));

    expect(onItemsChange.mock.calls[0]?.[1].reason).toBe("close-press");
    expect(getByTestId("tab-b").getAttribute("aria-expanded")).toBe("true");
  });

  test("Delete reports the keyboard, and a cancelled close leaves focus alone", () => {
    const onItemsChange = mock<ItemsChange>((_, eventDetails) => eventDetails.cancel());
    const { getByTestId } = render(<Strip onItemsChange={onItemsChange} />);
    const tab = getByTestId("tab-c");
    act(() => tab.focus());

    fireEvent.keyDown(tab, { key: "Delete" });

    expect(onItemsChange.mock.calls[0]?.[1].reason).toBe("keyboard");
    expect(document.activeElement).toBe(tab);
  });

  test("Escape reports the key", () => {
    const onValueChange = mock<ValueChange>();
    render(<Strip onValueChange={onValueChange} />);

    fireEvent.keyDown(window, { key: "Escape" });

    expect(onValueChange.mock.calls[0]).toEqual([null, expect.anything()]);
    expect(onValueChange.mock.calls[0]?.[1].reason).toBe("escape-key");
  });

  test("arrowing with activateOnFocus reports list navigation", () => {
    const onValueChange = mock<ValueChange>();
    const { getByTestId } = render(<Strip activateOnFocus onValueChange={onValueChange} />);
    const tab = getByTestId("tab-b");
    act(() => tab.focus());

    fireEvent.keyDown(tab, { key: "ArrowRight" });

    expect(onValueChange.mock.calls[0]?.[0]).toBe("c");
    expect(onValueChange.mock.calls[0]?.[1].reason).toBe("list-navigation");
  });

  test("cancelling the selection that follows a close still moves focus to the next tab", () => {
    const onValueChange = mock<ValueChange>((_, eventDetails) => eventDetails.cancel());
    const { getByTestId } = render(<Strip onValueChange={onValueChange} />);

    fireEvent.click(getByTestId("close-b"));

    expect(document.activeElement).toBe(getByTestId("tab-c"));
  });
});
