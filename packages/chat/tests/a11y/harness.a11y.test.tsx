import { describe, expect, test } from "bun:test";
import { cleanup, render } from "@testing-library/react";
import axe from "axe-core";
import { Chip } from "../../src/chip";
import { expectNoAxeViolations } from "./axe";

// Harness smoke tests: prove the happy-dom + testing-library + axe stack
// renders primitives and that axe genuinely detects violations here — a
// harness that can only pass is not a harness.

describe("a11y harness", () => {
  test("renders a primitive and passes structural axe", async () => {
    const { container } = render(
      <Chip>
        <Chip.Label>PRD.md</Chip.Label>
      </Chip>,
    );
    await expectNoAxeViolations(container);
    cleanup();
  });

  test("axe detects a violation in this environment (negative control)", async () => {
    const { container } = render(
      // biome-ignore lint/a11y/useButtonType: deliberate violation fixture
      <button aria-label="" />,
    );
    const results = await axe.run(container, {
      runOnly: { type: "tag", values: ["wcag2a"] },
    });
    expect(results.violations.length).toBeGreaterThan(0);
    cleanup();
  });
});
