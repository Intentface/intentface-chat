import { describe, expect, test } from "bun:test";
import { render } from "@testing-library/react";
import axe from "axe-core";
import { Tabs, useTabs } from "../../src/tabs";

const PAGE_LEVEL_RULES = {
  region: { enabled: false },
  "page-has-heading-one": { enabled: false },
  "landmark-one-main": { enabled: false },
  /**
   * Deliberate, and the only rule this package suppresses.
   *
   * A tab is a `div[role="button"]` with the close button nested inside it, so
   * the whole pill is a click target — the shape Linear ships. `role="button"`
   * has children-presentational in ARIA, so a focusable descendant is a
   * violation. The alternatives were a real `<button>`, which the HTML parser
   * reshapes and breaks hydration, or splitting the pill into a wrapper plus a
   * button, which was rejected for the API it forced.
   *
   * The trade is that the close button is not announced as its own control.
   * `Delete` on the tab closes it, which is the keyboard route regardless.
   * The test below asserts the violation is still exactly this and nothing
   * else, so a future change cannot quietly widen it.
   */
  "nested-interactive": { enabled: false },
} satisfies axe.RuleObject;

const audit = async (container: HTMLElement) => {
  const results = await axe.run(container, { rules: PAGE_LEVEL_RULES });
  return results.violations.map((violation) => `${violation.id}: ${violation.help}`);
};

const Strip = () => {
  const items = useTabs((tabs) => tabs.items);

  return (
    <Tabs.List aria-label="Open documents">
      {items.map((id) => (
        <Tabs.Trigger key={id} value={id}>
          {id}
          <Tabs.Close aria-label={`Close ${id}`}>×</Tabs.Close>
        </Tabs.Trigger>
      ))}
    </Tabs.List>
  );
};

const Collection = ({ value }: { value?: string | null }) => (
  <Tabs.Root defaultItems={["a", "b"]} defaultValue={value === undefined ? "a" : value}>
    <Strip />
    <Tabs.Viewport>{(id) => <p>{`Panel ${id}`}</p>}</Tabs.Viewport>
  </Tabs.Root>
);

describe("Tabs accessibility", () => {
  test("with a tab open, it raises nothing", async () => {
    const { container } = render(<Collection />);
    expect(await audit(container)).toEqual([]);
  });

  test("with nothing open, it raises nothing either", async () => {
    // A dock closed down to no open tab is a normal state, not a broken one.
    const { container } = render(<Collection value={null} />);
    expect(await audit(container)).toEqual([]);
  });

  test("the one rule we break is the one we chose to", async () => {
    const { container } = render(<Collection />);

    const results = await axe.run(container, { runOnly: ["nested-interactive"] });
    const nodes = results.violations.flatMap((violation) => violation.nodes);

    // One per tab, each reported against the tab that contains a close
    // button. Anything else here would mean the suppression covers more than
    // it was meant to.
    expect(nodes).toHaveLength(2);
    for (const node of nodes) {
      expect(node.html).toContain("data-tabs-trigger");
    }
  });

  test("the close button is reachable by name, not just by pointer", () => {
    const { getByRole } = render(<Collection />);
    expect(getByRole("button", { name: "Close a" })).toBeTruthy();
  });
});

describe("Tabs.Icon", () => {
  const WithIcons = () => (
    <Tabs.Root defaultItems={["a"]} defaultValue="a">
      <Tabs.List aria-label="Docs">
        <Tabs.Trigger value="a">
          <Tabs.Icon data-testid="icon">
            <svg height="12" viewBox="0 0 12 12" width="12">
              <title>decorative</title>
              <circle cx="6" cy="6" r="5" />
            </svg>
          </Tabs.Icon>
          README
        </Tabs.Trigger>
      </Tabs.List>
    </Tabs.Root>
  );

  test("stays out of the accessible name", () => {
    const { getByRole, getByTestId } = render(<WithIcons />);

    expect(getByTestId("icon").getAttribute("aria-hidden")).toBe("true");
    // The icon's own <title> would otherwise land in the button's name.
    expect(getByRole("button", { name: "README" })).toBeTruthy();
  });

  test("knows whether its tab is open, without a group selector", () => {
    const { getByTestId } = render(<WithIcons />);
    expect(getByTestId("icon").hasAttribute("data-selected")).toBe(true);
  });

  test("raises nothing", async () => {
    const { container } = render(<WithIcons />);
    expect(await audit(container)).toEqual([]);
  });
});
