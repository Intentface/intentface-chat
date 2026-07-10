import { describe, expect, test } from "bun:test";
import { act, cleanup, render, screen } from "@testing-library/react";
import { Reasoning } from "../../src/reasoning";
import { Steps } from "../../src/steps";
import { expectNoAxeViolations } from "./axe";

// Phase 4: display primitives — the active step is aria-current, Steps.Status
// speaks the otherwise icon-only status, disclosures toggle by keyboard, and
// a streaming reasoning block is aria-busy.

describe("display primitives a11y", () => {
  test("steps: active item is aria-current and Status announces", async () => {
    const { container } = render(
      <Steps>
        <Steps.Item status="complete">
          <Steps.Trigger>
            <Steps.Icon />
            <Steps.Label>Read the file</Steps.Label>
            <Steps.Status />
          </Steps.Trigger>
          <Steps.Panel>Details</Steps.Panel>
        </Steps.Item>
        <Steps.Item status="active">
          <Steps.Trigger>
            <Steps.Icon />
            <Steps.Label>Searching the web</Steps.Label>
            <Steps.Status>Running</Steps.Status>
          </Steps.Trigger>
          <Steps.Panel>Details</Steps.Panel>
        </Steps.Item>
      </Steps>,
    );

    const items = container.querySelectorAll("[data-steps-item]");
    expect(items[0]?.getAttribute("aria-current")).toBeNull();
    expect(items[1]?.getAttribute("aria-current")).toBe("step");

    // Default = the resolved status string; children override for copy.
    const statuses = container.querySelectorAll("[data-steps-status]");
    expect(statuses[0]?.textContent).toBe("complete");
    expect(statuses[1]?.textContent).toBe("Running");

    // Disclosure contract: real buttons, aria-expanded tracks toggling.
    const trigger = screen.getByRole("button", { name: /Searching the web/ });
    expect(trigger.getAttribute("aria-expanded")).toBe("true");
    act(() => {
      trigger.click();
    });
    expect(trigger.getAttribute("aria-expanded")).toBe("false");

    await expectNoAxeViolations(container);
    cleanup();
  });

  test("reasoning: root is aria-busy while streaming", async () => {
    const { container, rerender } = render(
      <Reasoning isStreaming>
        <Reasoning.Trigger>Reasoning</Reasoning.Trigger>
        <Reasoning.Content>Thinking about it…</Reasoning.Content>
      </Reasoning>,
    );

    const root = container.querySelector("[data-reasoning]");
    expect(root?.getAttribute("aria-busy")).toBe("true");

    rerender(
      <Reasoning isStreaming={false}>
        <Reasoning.Trigger>Reasoning</Reasoning.Trigger>
        <Reasoning.Content>Thinking about it…</Reasoning.Content>
      </Reasoning>,
    );
    expect(root?.getAttribute("aria-busy")).toBeNull();

    await expectNoAxeViolations(container);
    cleanup();
  });
});
