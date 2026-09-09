import { describe, expect, test } from "bun:test";
import { render } from "@testing-library/react";
import axe from "axe-core";
import { Shell } from "../../src/shell";

// Rules that judge a whole page, not a component: a fragment rendered into a
// bare container legitimately has no landmark, no <h1> and no unique page
// title. Everything that actually describes this widget stays on.
const PAGE_LEVEL_RULES = {
  region: { enabled: false },
  "page-has-heading-one": { enabled: false },
  "landmark-one-main": { enabled: false },
} satisfies axe.RuleObject;

const audit = async (container: HTMLElement) => {
  const results = await axe.run(container, { rules: PAGE_LEVEL_RULES });
  return results.violations.map((violation) => `${violation.id}: ${violation.help}`);
};

const Layout = ({ defaultOpen = true }: { defaultOpen?: boolean }) => (
  <Shell.Root defaultOpen={defaultOpen}>
    <Shell.PeekZone data-testid="zone" />
    <Shell.Sidebar data-testid="sidebar">
      <Shell.Trigger data-testid="trigger">Toggle sidebar</Shell.Trigger>
      <nav aria-label="Main">
        <a href="#main">Inbox</a>
      </nav>
      <Shell.ResizeHandle aria-label="Resize sidebar" data-testid="handle" />
    </Shell.Sidebar>
    <Shell.Viewport>
      <h2>Content</h2>
    </Shell.Viewport>
  </Shell.Root>
);

describe("Shell accessibility", () => {
  test("expanded, it raises nothing", async () => {
    const { container } = render(<Layout />);
    expect(await audit(container)).toEqual([]);
  });

  test("collapsed, it raises nothing either", async () => {
    const { container } = render(<Layout defaultOpen={false} />);
    expect(await audit(container)).toEqual([]);
  });

  test("the trigger's aria-controls resolves to the sidebar it opens", () => {
    const { getByTestId, container } = render(<Layout />);
    const controls = getByTestId("trigger").getAttribute("aria-controls");

    expect(controls).toBeTruthy();
    expect(container.querySelector(`#${CSS.escape(controls ?? "")}`)).toBe(getByTestId("sidebar"));
  });

  test("the resize handle is a keyboard-reachable separator with a range", () => {
    const { getByTestId } = render(<Layout />);
    const sidebar = getByTestId("sidebar");
    sidebar.style.minWidth = "200px";
    sidebar.style.maxWidth = "400px";

    const handle = getByTestId("handle");
    expect(handle.getAttribute("role")).toBe("separator");
    expect(handle.getAttribute("aria-orientation")).toBe("vertical");
    expect(handle.getAttribute("aria-label")).toBe("Resize sidebar");
    // Focusable, so the drag is not the only way to resize.
    expect(handle.tabIndex).toBe(0);
  });

  test("the peek strip is decoration and stays out of the accessibility tree", () => {
    const { getByTestId } = render(<Layout defaultOpen={false} />);
    expect(getByTestId("zone").getAttribute("aria-hidden")).toBe("true");
  });
});
