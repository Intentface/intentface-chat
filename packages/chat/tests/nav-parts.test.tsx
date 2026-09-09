import { describe, expect, test } from "bun:test";
import { act, fireEvent, render } from "@testing-library/react";
import { Nav } from "../src/nav";

const wait = (ms = 20) => new Promise((resolve) => setTimeout(resolve, ms));
/** A collapsed list unmounts only once its exit animation settles. */
const settle = () => act(() => wait());

/**
 * Three levels, so the recursion is actually under test rather than assumed:
 * inbox · workspace › (projects, teams › (issues))
 */
const Tree = (root: Partial<Parameters<typeof Nav.Root>[0]> = {}) => (
  <Nav.Root data-testid="root" {...root}>
    <Nav.List data-testid="list-0">
      <Nav.Item value="inbox" data-testid="inbox">
        <Nav.Label>Inbox</Nav.Label>
      </Nav.Item>

      <Nav.Group value="workspace" data-testid="group-workspace">
        <Nav.Trigger data-testid="trigger-workspace">
          <Nav.Label>Workspace</Nav.Label>
          <Nav.Action data-testid="action-workspace" aria-label="Workspace options" />
        </Nav.Trigger>

        <Nav.List data-testid="list-1" guide="branches">
          <Nav.Item value="projects" data-testid="projects">
            <Nav.Label>Projects</Nav.Label>
          </Nav.Item>

          <Nav.Group value="teams" data-testid="group-teams">
            <Nav.Trigger data-testid="trigger-teams">
              <Nav.Label>Teams</Nav.Label>
            </Nav.Trigger>
            <Nav.List data-testid="list-2" guide="rail">
              <Nav.Item value="issues" data-testid="issues">
                <Nav.Label>Issues</Nav.Label>
              </Nav.Item>
            </Nav.List>
          </Nav.Group>
        </Nav.List>
      </Nav.Group>
    </Nav.List>
  </Nav.Root>
);

describe("structure", () => {
  test("one part nests inside itself, to any depth", () => {
    const { getByTestId, queryByTestId } = render(
      Tree({ defaultExpanded: ["workspace", "teams"] }),
    );

    expect(getByTestId("list-0").getAttribute("data-depth")).toBe("0");
    expect(getByTestId("list-1").getAttribute("data-depth")).toBe("1");
    expect(getByTestId("list-2").getAttribute("data-depth")).toBe("2");
    expect(queryByTestId("list-0")?.hasAttribute("data-nested")).toBe(false);
    expect(getByTestId("list-2").hasAttribute("data-nested")).toBe(true);
  });

  test("depth is published as a custom property, so one CSS rule indents every level", () => {
    const { getByTestId } = render(Tree({ defaultExpanded: ["workspace", "teams"] }));

    expect(getByTestId("list-2").style.getPropertyValue("--nav-depth")).toBe("2");
  });

  test("a closed group renders nothing at all", () => {
    const { queryByTestId } = render(Tree());

    expect(queryByTestId("list-1")).toBeNull();
    expect(queryByTestId("projects")).toBeNull();
  });

  test("the guide is a ladder, and each rung emits the ones below it", () => {
    // A rail lives in the indent lane and an elbow needs a rail, so the rungs
    // were never independent. Emitting them cumulatively is what lets a
    // stylesheet ask for `[data-indent]` once and size the lane for all of them.
    const rungs = (element: HTMLElement) =>
      ["indent", "rail", "branches"].filter((rung) => element.hasAttribute(`data-${rung}`));

    const { getByTestId } = render(
      <Nav.Root defaultExpanded={["a", "b", "c"]}>
        <Nav.List data-testid="none">
          <Nav.Group value="a">
            <Nav.Trigger>
              <Nav.Label>A</Nav.Label>
            </Nav.Trigger>
            <Nav.List data-testid="indent" guide="indent">
              <Nav.Group value="b">
                <Nav.Trigger>
                  <Nav.Label>B</Nav.Label>
                </Nav.Trigger>
                <Nav.List data-testid="rail" guide="rail">
                  <Nav.Group value="c">
                    <Nav.Trigger>
                      <Nav.Label>C</Nav.Label>
                    </Nav.Trigger>
                    <Nav.List data-testid="branches" guide="branches">
                      <Nav.Item value="leaf">
                        <Nav.Label>Leaf</Nav.Label>
                      </Nav.Item>
                    </Nav.List>
                  </Nav.Group>
                </Nav.List>
              </Nav.Group>
            </Nav.List>
          </Nav.Group>
        </Nav.List>
      </Nav.Root>,
    );

    expect(rungs(getByTestId("none"))).toEqual([]);
    expect(rungs(getByTestId("indent"))).toEqual(["indent"]);
    expect(rungs(getByTestId("rail"))).toEqual(["indent", "rail"]);
    expect(rungs(getByTestId("branches"))).toEqual(["indent", "rail", "branches"]);
  });

  test("the Root sets the default and any list may overrule it", () => {
    const { getByTestId } = render(
      <Nav.Root defaultExpanded={["a", "b"]} guide="indent">
        <Nav.List data-testid="opted-out" guide="none">
          <Nav.Group value="a">
            <Nav.Trigger>
              <Nav.Label>A</Nav.Label>
            </Nav.Trigger>
            <Nav.List data-testid="inherits">
              <Nav.Group value="b">
                <Nav.Trigger>
                  <Nav.Label>B</Nav.Label>
                </Nav.Trigger>
                <Nav.List data-testid="raised" guide="branches">
                  <Nav.Item value="leaf">
                    <Nav.Label>Leaf</Nav.Label>
                  </Nav.Item>
                </Nav.List>
              </Nav.Group>
            </Nav.List>
          </Nav.Group>
        </Nav.List>
      </Nav.Root>,
    );

    expect(getByTestId("opted-out").hasAttribute("data-indent")).toBe(false);
    expect(getByTestId("inherits").hasAttribute("data-indent")).toBe(true);
    expect(getByTestId("inherits").hasAttribute("data-rail")).toBe(false);
    expect(getByTestId("raised").hasAttribute("data-branches")).toBe(true);
  });

  test("the rail is a signal, not geometry", () => {
    const { getByTestId } = render(Tree({ defaultExpanded: ["workspace"] }));
    const list = getByTestId("list-1");

    expect(list.hasAttribute("data-rail")).toBe(true);
    expect(list.hasAttribute("data-branches")).toBe(true);
    // Branches without a rail is nothing to hang an elbow off.
    expect(getByTestId("list-0").hasAttribute("data-branches")).toBe(false);
  });

  test("parts outside a Root throw rather than reading from nowhere", () => {
    expect(() => render(<Nav.Item value="orphan" />)).toThrow(/within <Nav.Root>/);
  });

  test("a Trigger outside a Group throws — it has no value of its own", () => {
    expect(() =>
      render(
        <Nav.Root>
          <Nav.List>
            <Nav.Trigger />
          </Nav.List>
        </Nav.Root>,
      ),
    ).toThrow(/within <Nav.Group>/);
  });
});

describe("expanding", () => {
  test("a trigger toggles its own group and says so", async () => {
    const { getByTestId, queryByTestId } = render(Tree());
    const trigger = getByTestId("trigger-workspace");

    expect(trigger.getAttribute("aria-expanded")).toBe("false");
    fireEvent.click(trigger);
    expect(trigger.getAttribute("aria-expanded")).toBe("true");
    expect(getByTestId("projects")).toBeTruthy();

    fireEvent.click(trigger);
    await settle();
    expect(queryByTestId("projects")).toBeNull();
  });

  test("the trigger and its list point at each other", () => {
    const { getByTestId } = render(Tree({ defaultExpanded: ["workspace"] }));

    expect(getByTestId("trigger-workspace").getAttribute("aria-controls")).toBe(
      getByTestId("list-1").id,
    );
  });

  test("open and closed are both expressible", async () => {
    const { getByTestId } = render(Tree({ defaultExpanded: ["workspace"] }));

    expect(getByTestId("group-workspace").hasAttribute("data-open")).toBe(true);
    fireEvent.click(getByTestId("trigger-workspace"));
    await settle();
    expect(getByTestId("group-workspace").hasAttribute("data-closed")).toBe(true);
  });

  test("controlled: the prop wins and the store does not self-commit", () => {
    const seen: string[][] = [];
    const { getByTestId, queryByTestId } = render(
      Tree({ expanded: [], onExpandedChange: (next) => seen.push(next) }),
    );

    fireEvent.click(getByTestId("trigger-workspace"));
    expect(seen).toEqual([["workspace"]]);
    // The prop never changed, so neither did the tree.
    expect(queryByTestId("projects")).toBeNull();
  });
});

describe("measurement", () => {
  test("a settled list blocks the length rather than merely omitting it", () => {
    /*
     * The pin is temporary — an open, settled list is free to grow. But it has
     * to say so, not stay silent: custom properties inherit, so a list that
     * omits this picks up an ancestor's pinned length and, through
     * `height: var(--nav-list-height)`, takes that height as its own.
     *
     * `initial` is the guaranteed-invalid value on an unregistered property,
     * so `var()` fails and `height` falls back to `auto`.
     */
    const { getByTestId } = render(Tree({ defaultExpanded: ["workspace", "teams"] }));

    for (const id of ["list-1", "list-2"]) {
      const style = getByTestId(id).style;
      expect(style.getPropertyValue("--nav-list-height")).toBe("initial");
      expect(style.getPropertyValue("--nav-list-width")).toBe("initial");
    }
  });

  test("a nested list never inherits an ancestor's pinned length", () => {
    // The inner group is already open and the outer one is not — which is when
    // this bites: opening the outer pins it, and an inner list that inherited
    // the pin would take the parent's height as its own and shove everything
    // after it down the page until the pin is released.
    const { getByTestId } = render(Tree({ defaultExpanded: ["teams"] }));

    fireEvent.click(getByTestId("trigger-workspace"));

    const outer = getByTestId("list-1").style.getPropertyValue("--nav-list-height");
    const inner = getByTestId("list-2").style.getPropertyValue("--nav-list-height");

    expect(inner).toBe("initial");
    expect(inner).not.toBe(outer);
  });

  test("measuring puts the caller's own height back", () => {
    // Reading `scrollHeight` through a pinned height is a ratchet — with
    // `overflow: hidden` it returns the box when the box is the larger — so the
    // measurement lifts the height first. Leaving that lift behind would pin
    // every list open, which no layout-free test environment would reveal.
    const { getByTestId } = render(
      <Nav.Root>
        <Nav.List>
          <Nav.Group value="workspace">
            <Nav.Trigger data-testid="trigger">
              <Nav.Label>Workspace</Nav.Label>
            </Nav.Trigger>
            <Nav.List data-testid="sized" style={{ height: "120px" }}>
              <Nav.Item value="projects">
                <Nav.Label>Projects</Nav.Label>
              </Nav.Item>
            </Nav.List>
          </Nav.Group>
        </Nav.List>
      </Nav.Root>,
    );

    // Closed to begin with, so opening it is what runs a measurement.
    fireEvent.click(getByTestId("trigger"));

    const style = getByTestId("sized").style;
    expect(style.height).toBe("120px");
    expect(style.getPropertyPriority("height")).toBe("");
  });

  test("a descendant's pinned height is lifted too, and put back", () => {
    // A nested list may be mid-transition or still holding a length it has not
    // released. Measuring around one makes the parent adopt a height its content
    // never wanted — and jump to the real one when the descendant releases.
    const { getByTestId } = render(
      <Nav.Root defaultExpanded={["teams"]}>
        <Nav.List>
          <Nav.Group value="workspace">
            <Nav.Trigger data-testid="trigger">
              <Nav.Label>Workspace</Nav.Label>
            </Nav.Trigger>
            <Nav.List>
              <Nav.Group value="teams">
                <Nav.Trigger>
                  <Nav.Label>Teams</Nav.Label>
                </Nav.Trigger>
                <Nav.List data-testid="inner" style={{ height: "80px" }}>
                  <Nav.Item value="issues">
                    <Nav.Label>Issues</Nav.Label>
                  </Nav.Item>
                </Nav.List>
              </Nav.Group>
            </Nav.List>
          </Nav.Group>
        </Nav.List>
      </Nav.Root>,
    );

    // Opening the outer group measures through the inner one.
    fireEvent.click(getByTestId("trigger"));

    expect(getByTestId("inner").style.height).toBe("80px");
    expect(getByTestId("inner").style.getPropertyPriority("height")).toBe("");
  });

  test("and leaves no height behind when the caller set none", async () => {
    const { getByTestId } = render(Tree());
    fireEvent.click(getByTestId("trigger-workspace"));
    await settle();

    expect(getByTestId("list-1").style.height).toBe("");
  });
});

/**
 * Linear's shape, which is the hard one: a railless group whose child group has
 * a rail, three levels of nesting, and a collapsed group as the last child.
 */
const Teams = (root: Partial<Parameters<typeof Nav.Root>[0]> = {}) => (
  <Nav.Root {...root}>
    <Nav.List data-testid="d0">
      <Nav.Group value="teams">
        <Nav.Trigger data-testid="teams">
          <Nav.Label>Your teams</Nav.Label>
        </Nav.Trigger>

        {/* No rail here — a section heading's list usually wants none. */}
        <Nav.List data-testid="d1">
          <Nav.Group value="intentface">
            <Nav.Trigger data-testid="intentface">
              <Nav.Label>Intentface</Nav.Label>
            </Nav.Trigger>

            <Nav.List data-testid="d2" guide="branches">
              <Nav.Item value="team-home" data-testid="team-home">
                <Nav.Label>Home</Nav.Label>
              </Nav.Item>

              <Nav.Group value="chat">
                <Nav.Trigger data-testid="chat">
                  <Nav.Label>Chat</Nav.Label>
                </Nav.Trigger>
                <Nav.List data-testid="d3" guide="branches">
                  <Nav.Item value="chat-home" data-testid="chat-home">
                    <Nav.Label>Home</Nav.Label>
                  </Nav.Item>
                </Nav.List>
              </Nav.Group>

              <Nav.Group value="website">
                <Nav.Trigger data-testid="website">
                  <Nav.Label>Website</Nav.Label>
                </Nav.Trigger>
                <Nav.List data-testid="d3-site" guide="branches">
                  <Nav.Item value="site-home">
                    <Nav.Label>Home</Nav.Label>
                  </Nav.Item>
                </Nav.List>
              </Nav.Group>
            </Nav.List>
          </Nav.Group>
        </Nav.List>
      </Nav.Group>
    </Nav.List>
  </Nav.Root>
);

const OPEN = ["teams", "intentface", "chat"];

describe("a railless group holding a railed one", () => {
  test("rails are per-group, not per-depth", () => {
    const { getByTestId } = render(Teams({ defaultExpanded: OPEN }));

    // The two outer lists carry none; the two inner ones do. Deriving the rail
    // from depth would make this shape inexpressible.
    for (const id of ["d0", "d1"]) {
      expect(getByTestId(id).hasAttribute("data-rail")).toBe(false);
    }
    for (const id of ["d2", "d3"]) {
      expect(getByTestId(id).hasAttribute("data-rail")).toBe(true);
      expect(getByTestId(id).hasAttribute("data-branches")).toBe(true);
    }
  });

  test("depth keeps counting past the level the rail starts at", () => {
    const { getByTestId } = render(Teams({ defaultExpanded: OPEN }));

    for (const [id, depth] of [
      ["d0", "0"],
      ["d1", "1"],
      ["d2", "2"],
      ["d3", "3"],
    ] as const) {
      expect(getByTestId(id).getAttribute("data-depth")).toBe(depth);
      expect(getByTestId(id).style.getPropertyValue("--nav-depth")).toBe(depth);
    }
  });

  test("a collapsed group beside an open one renders nothing of its own", () => {
    const { getByTestId, queryByTestId } = render(Teams({ defaultExpanded: OPEN }));

    expect(getByTestId("d3")).toBeTruthy();
    expect(queryByTestId("d3-site")).toBeNull();
    expect(getByTestId("website").getAttribute("aria-expanded")).toBe("false");
  });

  test("one tab stop, however deep the tree goes", () => {
    const { container } = render(Teams({ defaultExpanded: OPEN }));
    expect(container.querySelectorAll('[tabindex="0"]')).toHaveLength(1);
  });

  test("arrows walk every level as one list", () => {
    const { getByTestId } = render(Teams({ defaultExpanded: OPEN }));
    const home = getByTestId("team-home");
    act(() => home.focus());

    // depth 2 → the depth-2 trigger → into depth 3
    fireEvent.keyDown(home, { key: "ArrowDown" });
    expect(document.activeElement).toBe(getByTestId("chat"));

    fireEvent.keyDown(document.activeElement as Element, { key: "ArrowDown" });
    expect(document.activeElement).toBe(getByTestId("chat-home"));

    // …and out of it again, to the collapsed sibling.
    fireEvent.keyDown(document.activeElement as Element, { key: "ArrowDown" });
    expect(document.activeElement).toBe(getByTestId("website"));
  });
});
