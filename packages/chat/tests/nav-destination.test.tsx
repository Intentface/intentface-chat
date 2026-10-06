import { describe, expect, mock, test } from "bun:test";
import { act, fireEvent, render } from "@testing-library/react";
import { Nav } from "../src/nav";

const wait = (ms = 20) => new Promise((resolve) => setTimeout(resolve, ms));
const settle = () => act(() => wait());

const focus = (element: HTMLElement) => {
  act(() => element.focus());
  return element;
};

type Handlers = {
  onActivate?: () => void;
  onDoubleClick?: () => void;
  toggleOnClick?: boolean;
  disabled?: boolean;
  active?: boolean;
};

/**
 * guides is a branch that is also a page: pressing the row routes, and the
 * caret opens it. inbox is an ordinary leaf, for the `aria-current` checks.
 */
const Tree = ({
  onActivate,
  onDoubleClick,
  toggleOnClick = false,
  disabled,
  active,
  ...root
}: Handlers & Partial<Parameters<typeof Nav.Root>[0]>) => (
  <Nav.Root {...root}>
    <Nav.List>
      <Nav.Item value="inbox" data-testid="inbox">
        <Nav.Label>Inbox</Nav.Label>
      </Nav.Item>

      <Nav.Group value="guides" disabled={disabled} data-testid="group-guides">
        <Nav.Trigger
          toggleOnClick={toggleOnClick}
          active={active}
          onClick={onActivate}
          onDoubleClick={onDoubleClick}
          data-testid="trigger-guides"
        >
          <Nav.Toggle data-testid="toggle-guides" />
          <Nav.Label>Guides</Nav.Label>
        </Nav.Trigger>
        <Nav.List>
          <Nav.Item value="install" data-testid="install">
            <Nav.Label>Install</Nav.Label>
          </Nav.Item>
        </Nav.List>
      </Nav.Group>
    </Nav.List>
  </Nav.Root>
);

describe("a branch that is also a destination", () => {
  test("pressing the row activates it and leaves the group alone", () => {
    const onActivate = mock();
    const { getByTestId, queryByTestId } = render(<Tree onActivate={onActivate} />);

    fireEvent.click(getByTestId("trigger-guides"));

    expect(onActivate).toHaveBeenCalledTimes(1);
    expect(getByTestId("trigger-guides").getAttribute("aria-expanded")).toBe("false");
    expect(queryByTestId("install")).toBeNull();
  });

  test("Enter and Space activate it as a click would, not as a toggle", () => {
    const onActivate = mock();
    const { getByTestId } = render(<Tree onActivate={onActivate} />);
    const trigger = focus(getByTestId("trigger-guides"));

    fireEvent.keyDown(trigger, { key: "Enter" });
    fireEvent.keyDown(trigger, { key: " " });

    expect(onActivate).toHaveBeenCalledTimes(2);
    expect(trigger.getAttribute("aria-expanded")).toBe("false");
  });

  test("the toggle opens and closes the group without activating the row", async () => {
    const onActivate = mock();
    const { getByTestId, queryByTestId } = render(<Tree onActivate={onActivate} />);
    const toggle = getByTestId("toggle-guides");

    fireEvent.click(toggle);
    expect(getByTestId("trigger-guides").getAttribute("aria-expanded")).toBe("true");
    expect(getByTestId("install")).toBeTruthy();

    fireEvent.click(toggle);
    await settle();
    expect(queryByTestId("install")).toBeNull();

    expect(onActivate).not.toHaveBeenCalled();
  });

  test("two quick presses on the toggle are two toggles, not a double-click on the row", () => {
    const onDoubleClick = mock();
    const { getByTestId } = render(<Tree onDoubleClick={onDoubleClick} />);

    fireEvent.doubleClick(getByTestId("toggle-guides"));

    expect(onDoubleClick).not.toHaveBeenCalled();
  });

  test("the arrow keys still open and close it, so the keyboard needs no toggle", () => {
    const { getByTestId } = render(<Tree />);
    const trigger = focus(getByTestId("trigger-guides"));

    fireEvent.keyDown(trigger, { key: "ArrowRight" });
    expect(trigger.getAttribute("aria-expanded")).toBe("true");

    fireEvent.keyDown(trigger, { key: "ArrowRight" });
    expect(document.activeElement).toBe(getByTestId("install"));

    fireEvent.keyDown(document.activeElement as Element, { key: "ArrowLeft" });
    fireEvent.keyDown(document.activeElement as Element, { key: "ArrowLeft" });
    expect(trigger.getAttribute("aria-expanded")).toBe("false");
  });

  test("the toggle is decoration to assistive tech and publishes the group's state", () => {
    const { getByTestId } = render(<Tree defaultExpanded={["guides"]} />);
    const toggle = getByTestId("toggle-guides");

    expect(toggle.getAttribute("aria-hidden")).toBe("true");
    expect(toggle.hasAttribute("tabindex")).toBe(false);
    expect(toggle.hasAttribute("data-open")).toBe(true);
  });

  test("a disabled group's toggle does nothing", () => {
    const { getByTestId } = render(<Tree disabled />);

    fireEvent.click(getByTestId("toggle-guides"));

    expect(getByTestId("trigger-guides").getAttribute("aria-expanded")).toBe("false");
  });

  test("beside a row that toggles on its own, one press is still one toggle", () => {
    // The toggle stops its click, so the row's own toggle never runs on top of
    // it and undoes the open.
    const { getByTestId } = render(<Tree toggleOnClick />);

    fireEvent.click(getByTestId("toggle-guides"));

    expect(getByTestId("trigger-guides").getAttribute("aria-expanded")).toBe("true");
  });

  test("by default the row is the disclosure, as before", () => {
    const { getByTestId } = render(<Tree toggleOnClick />);

    fireEvent.click(getByTestId("trigger-guides"));

    expect(getByTestId("trigger-guides").getAttribute("aria-expanded")).toBe("true");
  });
});

describe("aria-current", () => {
  test("an active row is the current page", () => {
    const { getByTestId } = render(<Tree active />);

    expect(getByTestId("trigger-guides").getAttribute("aria-current")).toBe("page");
    expect(getByTestId("inbox").hasAttribute("aria-current")).toBe(false);
  });

  test("an item says so as well as a trigger", () => {
    const { getByTestId } = render(
      <Nav.Root>
        <Nav.List>
          <Nav.Item value="inbox" active data-testid="inbox">
            <Nav.Label>Inbox</Nav.Label>
          </Nav.Item>
        </Nav.List>
      </Nav.Root>,
    );

    expect(getByTestId("inbox").getAttribute("aria-current")).toBe("page");
  });

  test("a tree that marks something other than a route can say so", () => {
    const { getByTestId } = render(
      <Nav.Root>
        <Nav.List>
          <Nav.Item value="draft" active aria-current="true" data-testid="draft">
            <Nav.Label>Draft</Nav.Label>
          </Nav.Item>
        </Nav.List>
      </Nav.Root>,
    );

    expect(getByTestId("draft").getAttribute("aria-current")).toBe("true");
  });
});
