import { describe, expect, test } from "bun:test";
import { act, fireEvent, render } from "@testing-library/react";
import { Nav } from "../src/nav";

/**
 * inbox · workspace › (projects, teams › (issues)) · settings
 *
 * Deep enough that stepping in and out has somewhere to go, and with a leaf
 * after the group so "out" and "down" are distinguishable.
 */
const Tree = (root: Partial<Parameters<typeof Nav.Root>[0]> = {}) => (
  <Nav.Root {...root}>
    <Nav.List>
      <Nav.Item value="inbox" data-testid="inbox">
        <Nav.Label>Inbox</Nav.Label>
      </Nav.Item>

      <Nav.Group value="workspace">
        <Nav.Trigger data-testid="trigger-workspace">
          <Nav.Label>Workspace</Nav.Label>
        </Nav.Trigger>
        <Nav.List>
          <Nav.Item value="projects" data-testid="projects">
            <Nav.Label>Projects</Nav.Label>
          </Nav.Item>
          <Nav.Group value="teams">
            <Nav.Trigger data-testid="trigger-teams">
              <Nav.Label>Teams</Nav.Label>
            </Nav.Trigger>
            <Nav.List>
              <Nav.Item value="issues" data-testid="issues">
                <Nav.Label>Issues</Nav.Label>
              </Nav.Item>
            </Nav.List>
          </Nav.Group>
        </Nav.List>
      </Nav.Group>

      <Nav.Item value="settings" data-testid="settings">
        <Nav.Label>Settings</Nav.Label>
      </Nav.Item>
    </Nav.List>
  </Nav.Root>
);

const open = ["workspace", "teams"];

/** Focusing a row sets the roving state, so it is a React update like any other. */
const focus = (element: HTMLElement) => {
  act(() => element.focus());
  return element;
};

describe("roving focus", () => {
  test("exactly one row is tabbable at a time", () => {
    const { getByTestId, container } = render(Tree({ defaultExpanded: open }));

    const tabbable = container.querySelectorAll('[tabindex="0"]');
    expect(tabbable.length).toBe(1);
    expect(tabbable[0]).toBe(getByTestId("inbox"));
  });

  test("down and up walk the visible rows, across every level", () => {
    const { getByTestId } = render(Tree({ defaultExpanded: open }));
    const inbox = getByTestId("inbox");
    focus(inbox);

    fireEvent.keyDown(inbox, { key: "ArrowDown" });
    expect(document.activeElement).toBe(getByTestId("trigger-workspace"));

    fireEvent.keyDown(document.activeElement as Element, { key: "ArrowDown" });
    expect(document.activeElement).toBe(getByTestId("projects"));

    fireEvent.keyDown(document.activeElement as Element, { key: "ArrowDown" });
    expect(document.activeElement).toBe(getByTestId("trigger-teams"));

    fireEvent.keyDown(document.activeElement as Element, { key: "ArrowUp" });
    expect(document.activeElement).toBe(getByTestId("projects"));
  });

  test("a collapsed group's rows are not in the walk", () => {
    const { getByTestId } = render(Tree());
    const trigger = getByTestId("trigger-workspace");
    focus(trigger);

    fireEvent.keyDown(trigger, { key: "ArrowDown" });
    expect(document.activeElement).toBe(getByTestId("settings"));
  });

  test("Home and End jump to the ends of what is visible", () => {
    const { getByTestId } = render(Tree({ defaultExpanded: open }));
    const projects = getByTestId("projects");
    focus(projects);

    fireEvent.keyDown(projects, { key: "End" });
    expect(document.activeElement).toBe(getByTestId("settings"));

    fireEvent.keyDown(document.activeElement as Element, { key: "Home" });
    expect(document.activeElement).toBe(getByTestId("inbox"));
  });

  test("without loop, the ends hold", () => {
    const { getByTestId } = render(Tree({ defaultExpanded: open }));
    const inbox = getByTestId("inbox");
    focus(inbox);

    fireEvent.keyDown(inbox, { key: "ArrowUp" });
    expect(document.activeElement).toBe(inbox);
  });

  test("with loop, the ends wrap", () => {
    const { getByTestId } = render(Tree({ defaultExpanded: open, loop: true }));
    const inbox = getByTestId("inbox");
    focus(inbox);

    fireEvent.keyDown(inbox, { key: "ArrowUp" });
    expect(document.activeElement).toBe(getByTestId("settings"));
  });
});

describe("stepping in and out", () => {
  test("right opens a closed group, then steps into it", () => {
    const { getByTestId } = render(Tree());
    const trigger = getByTestId("trigger-workspace");
    focus(trigger);

    fireEvent.keyDown(trigger, { key: "ArrowRight" });
    expect(trigger.getAttribute("aria-expanded")).toBe("true");
    // Opening is the whole action — the second press is what moves.
    expect(document.activeElement).toBe(trigger);

    fireEvent.keyDown(trigger, { key: "ArrowRight" });
    expect(document.activeElement).toBe(getByTestId("projects"));
  });

  test("left collapses an open group, and steps out of a leaf", () => {
    const { getByTestId } = render(Tree({ defaultExpanded: open }));
    const projects = getByTestId("projects");
    focus(projects);

    fireEvent.keyDown(projects, { key: "ArrowLeft" });
    expect(document.activeElement).toBe(getByTestId("trigger-workspace"));

    fireEvent.keyDown(document.activeElement as Element, { key: "ArrowLeft" });
    expect(getByTestId("trigger-workspace").getAttribute("aria-expanded")).toBe("false");
  });

  test("left from a nested leaf finds its own parent, not the outermost one", () => {
    const { getByTestId } = render(Tree({ defaultExpanded: open }));
    const issues = getByTestId("issues");
    focus(issues);

    fireEvent.keyDown(issues, { key: "ArrowLeft" });
    expect(document.activeElement).toBe(getByTestId("trigger-teams"));
  });
});

describe("typeahead", () => {
  test("typing seeks the next matching row", () => {
    const { getByTestId } = render(Tree({ defaultExpanded: open }));
    const inbox = getByTestId("inbox");
    focus(inbox);

    fireEvent.keyDown(inbox, { key: "s" });
    expect(document.activeElement).toBe(getByTestId("settings"));
  });

  test("it searches past the current row, so a repeated letter walks the matches", () => {
    const { getByTestId } = render(Tree({ defaultExpanded: open }));
    const projects = getByTestId("projects");
    focus(projects);

    // "p" from Projects must not simply find Projects again.
    fireEvent.keyDown(projects, { key: "i" });
    expect(document.activeElement).toBe(getByTestId("issues"));
  });

  test("a modifier chord is a shortcut, not a search", () => {
    const { getByTestId } = render(Tree({ defaultExpanded: open }));
    const inbox = getByTestId("inbox");
    focus(inbox);

    fireEvent.keyDown(inbox, { key: "s", metaKey: true });
    expect(document.activeElement).toBe(inbox);
  });

  test("typeahead={false} turns it off", () => {
    const { getByTestId } = render(Tree({ defaultExpanded: open, typeahead: false }));
    const inbox = getByTestId("inbox");
    focus(inbox);

    fireEvent.keyDown(inbox, { key: "s" });
    expect(document.activeElement).toBe(inbox);
  });
});

describe("activation", () => {
  test("Enter and Space press a row that is not a real button", () => {
    let pressed = 0;
    const { getByTestId } = render(
      <Nav.Root>
        <Nav.List>
          <Nav.Item value="inbox" data-testid="inbox" onClick={() => pressed++}>
            <Nav.Label>Inbox</Nav.Label>
          </Nav.Item>
        </Nav.List>
      </Nav.Root>,
    );

    fireEvent.keyDown(getByTestId("inbox"), { key: "Enter" });
    expect(pressed).toBe(1);
    fireEvent.keyDown(getByTestId("inbox"), { key: " " });
    expect(pressed).toBe(2);
  });

  test("an action inside a row does not activate the row", () => {
    let pressed = 0;
    let opened = 0;
    const { getByTestId } = render(
      <Nav.Root>
        <Nav.List>
          <Nav.Item value="inbox" data-testid="inbox" onClick={() => pressed++}>
            <Nav.Label>Inbox</Nav.Label>
            <Nav.Action data-testid="action" aria-label="Options" onClick={() => opened++} />
          </Nav.Item>
        </Nav.List>
      </Nav.Root>,
    );

    fireEvent.click(getByTestId("action"));
    expect(opened).toBe(1);
    expect(pressed).toBe(0);
  });
});
