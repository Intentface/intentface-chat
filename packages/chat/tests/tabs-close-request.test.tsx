import { describe, expect, mock, test } from "bun:test";
import { act, fireEvent, render } from "@testing-library/react";
import { Tabs, type TabsCloseRequestDetails } from "../src/tabs";
import { createTabsStore } from "../src/tabs/store";

type Request = (value: string, details: TabsCloseRequestDetails) => void;

const Strip = ({
  onCloseRequest,
  store,
}: {
  onCloseRequest?: Request;
  store?: ReturnType<typeof createTabsStore>;
}) => (
  <Tabs.Root
    store={store}
    defaultItems={["a", "b", "c"]}
    defaultValue="b"
    selectOnClose="adjacent"
    dismissOnEscape={false}
    onCloseRequest={onCloseRequest}
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

describe("onCloseRequest", () => {
  test("the close button asks first, and an answer of no keeps the tab", () => {
    const onCloseRequest = mock<Request>((_, details) => details.cancel());
    const { getByTestId } = render(<Strip onCloseRequest={onCloseRequest} />);

    fireEvent.click(getByTestId("close-b"));

    expect(onCloseRequest).toHaveBeenCalledTimes(1);
    expect(onCloseRequest.mock.calls[0]?.[0]).toBe("b");
    expect(onCloseRequest.mock.calls[0]?.[1].reason).toBe("close-button");
    expect(getByTestId("tab-b")).toBeTruthy();
    // Nothing moved: the selection is where it was.
    expect(getByTestId("tab-b").getAttribute("aria-expanded")).toBe("true");
  });

  test("Delete asks too, and says it was the key", () => {
    const onCloseRequest = mock<Request>((_, details) => details.cancel());
    const { getByTestId } = render(<Strip onCloseRequest={onCloseRequest} />);
    const tab = getByTestId("tab-b");
    act(() => tab.focus());

    fireEvent.keyDown(tab, { key: "Delete" });

    expect(onCloseRequest.mock.calls[0]?.[1].reason).toBe("delete-key");
    expect(getByTestId("tab-b")).toBeTruthy();
  });

  test("a request left alone closes as before, handing over the selection", () => {
    const onCloseRequest = mock<Request>();
    const { getByTestId, queryByTestId } = render(<Strip onCloseRequest={onCloseRequest} />);

    fireEvent.click(getByTestId("close-b"));

    expect(queryByTestId("tab-b")).toBeNull();
    expect(getByTestId("tab-c").getAttribute("aria-expanded")).toBe("true");
  });

  test("the details report whether the request was canceled", () => {
    let seen: TabsCloseRequestDetails | undefined;
    const { getByTestId } = render(
      <Strip
        onCloseRequest={(_, details) => {
          expect(details.canceled).toBe(false);
          details.cancel();
          seen = details;
        }}
      />,
    );

    fireEvent.click(getByTestId("close-a"));

    expect(seen?.canceled).toBe(true);
  });

  test("close() called in code never asks — it is already the decision", () => {
    const store = createTabsStore();
    const onCloseRequest = mock<Request>((_, details) => details.cancel());
    const { queryByTestId } = render(<Strip store={store} onCloseRequest={onCloseRequest} />);

    act(() => store.getSnapshot().close("a"));

    expect(onCloseRequest).not.toHaveBeenCalled();
    expect(queryByTestId("tab-a")).toBeNull();
  });

  test("the confirm-then-close round trip", () => {
    // The shape an editor with unsaved work takes: hold the close, ask, then
    // close for real once the answer is yes.
    const store = createTabsStore();
    let pending: string | null = null;
    const { getByTestId, queryByTestId } = render(
      <Strip
        store={store}
        onCloseRequest={(value, details) => {
          details.cancel();
          pending = value;
        }}
      />,
    );

    fireEvent.click(getByTestId("close-c"));
    expect(getByTestId("tab-c")).toBeTruthy();

    act(() => store.getSnapshot().close(pending as unknown as string));
    expect(queryByTestId("tab-c")).toBeNull();
  });
});
