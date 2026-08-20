import { describe, expect, test } from "bun:test";
import { act, cleanup, render, screen } from "@testing-library/react";
import { Steps } from "../src/steps";

// The panel measures its natural height for the open transition, then must RELEASE that
// measurement once the transition settles. Holding it pinned the panel to its open-time
// height for its whole open life, so anything that grew inside afterwards — a nested
// disclosure, streaming rows — was clipped.

const settle = () =>
  act(async () => {
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
  });

describe("collapsible panel height", () => {
  test("publishes --panel-height while opening, then releases it once settled", async () => {
    const { container } = render(
      <Steps.Root>
        <Steps.Item>
          <Steps.Trigger>Step</Steps.Trigger>
          <Steps.Panel>Details</Steps.Panel>
        </Steps.Item>
      </Steps.Root>,
    );

    act(() => {
      screen.getByRole("button", { name: "Step" }).click();
    });

    const panel = container.querySelector("[data-steps-panel]") as HTMLElement;
    expect(panel).not.toBeNull();
    // Measured on the starting frame, so the consumer's height transition has a number.
    expect(panel.style.getPropertyValue("--panel-height")).not.toBe("");

    await settle();

    // Released: the property is no longer written, so `height: var(--panel-height)` is
    // invalid at computed-value time and falls back to auto.
    expect(panel.style.getPropertyValue("--panel-height")).toBe("");
    cleanup();
  });

  test("an initially-open panel never pins a height", async () => {
    const { container } = render(
      <Steps.Root>
        <Steps.Item defaultOpen>
          <Steps.Trigger>Step</Steps.Trigger>
          <Steps.Panel>Details</Steps.Panel>
        </Steps.Item>
      </Steps.Root>,
    );
    await settle();

    const panel = container.querySelector("[data-steps-panel]") as HTMLElement;
    expect(panel).not.toBeNull();
    // No entry transition on mount, so there is nothing to measure and nothing to pin.
    expect(panel.style.getPropertyValue("--panel-height")).toBe("");
    cleanup();
  });
});
