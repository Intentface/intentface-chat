import { describe, expect, test } from "bun:test";
import { cleanup, render, screen } from "@testing-library/react";
import { Attachments } from "../../src/attachments";
import { Composer } from "../../src/composer";
import { expectNoAxeViolations } from "./axe";

// Phases 3+5: default accessible names on the icon-only controls, the
// Container tab-stop removal, and the attachments alert region.

describe("composer names a11y", () => {
  test("controls carry default names; the container is not a control", async () => {
    const { container } = render(
      <Composer onSubmit={() => {}}>
        <Composer.Container>
          <Composer.Textarea aria-label="Message" />
          <Composer.Attachments>
            <Composer.AttachmentTrigger />
          </Composer.Attachments>
          <Composer.Actions>
            <Composer.Submit />
          </Composer.Actions>
        </Composer.Container>
      </Composer>,
    );

    expect(screen.getByRole("button", { name: "Send message" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Add attachment" })).toBeTruthy();

    // The chrome is a mouse-only focus passthrough — no role, no tab stop.
    const chrome = container.querySelector("[data-composer-container]");
    expect(chrome?.getAttribute("role")).toBeNull();
    expect(chrome?.getAttribute("tabindex")).toBeNull();

    await expectNoAxeViolations(container);
    cleanup();
  });

  test("generating submit announces as stop", () => {
    render(
      <Composer onSubmit={() => {}}>
        <Composer.Submit isGenerating onStop={() => {}} />
      </Composer>,
    );
    expect(screen.getByRole("button", { name: "Stop generating" })).toBeTruthy();
    cleanup();
  });

  test("remove buttons announce per item and errors announce immediately", async () => {
    const { container } = render(
      <Attachments>
        <Attachments.Item>
          <Attachments.Remove filename="report.pdf" onRemove={() => {}} />
        </Attachments.Item>
        <Attachments.Trigger />
        <Attachments.Error>Too many files.</Attachments.Error>
      </Attachments>,
    );

    expect(screen.getByRole("button", { name: "Remove report.pdf" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Add attachment" })).toBeTruthy();
    expect(screen.getByRole("alert").textContent).toBe("Too many files.");

    await expectNoAxeViolations(container);
    cleanup();
  });
});
