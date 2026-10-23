// Shared axe assertion for the a11y layer: structural WCAG 2.1 AA checks
// (roles, names, aria-* target validity). Visual rules are disabled — the
// headless primitives ship no styling, so contrast/appearance belongs to the
// styled layer's own audits.

import { expect } from "bun:test";
import axe from "axe-core";

const STRUCTURAL_CONFIG: axe.RunOptions = {
  runOnly: {
    type: "tag",
    values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"],
  },
  rules: {
    // Visual-only rules — meaningless without the styled layer's CSS.
    "color-contrast": { enabled: false },
  },
};

export const expectNoAxeViolations = async (container: Element): Promise<void> => {
  const results = await axe.run(container, STRUCTURAL_CONFIG);
  const summary = results.violations.map(
    (violation) =>
      `${violation.id}: ${violation.help} → ${violation.nodes
        .map((node) => node.target.join(" "))
        .join(", ")}`,
  );
  expect(summary).toEqual([]);
};
