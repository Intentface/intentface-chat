import { describe, expect, test } from "bun:test";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { Composer } from "../../src/composer";
import type { CommandItemData } from "../../src/composer/types";
import { expectNoAxeViolations } from "./axe";

// Phase 2: the editor announces the command popup (combobox pattern) and the
// popup exposes listbox/option semantics with stable ids — the association a
// body-portaled popup cannot get any other way. Popup state is driven through
// the store mirror, exactly the channel the engine writes at runtime.

const ITEMS: CommandItemData[] = [
  { value: "rasmus", label: "Rasmus" },
  { value: "maija", label: "Maija" },
];

const ISSUES: CommandItemData[] = [
  { value: "INT-1", label: "INT-1 Login bug" },
  { value: "INT-2", label: "INT-2 Search bug" },
];

const COMMANDS = {
  "@": { kind: "insert" as const, trigger: "word-boundary" as const, items: ITEMS },
  "#": { kind: "insert" as const, trigger: "word-boundary" as const, items: ISSUES },
};

const CommandsHarness = ({ prefix }: { prefix: string }) => (
  <Composer.Command prefix={prefix}>
    <Composer.CommandList>
      {(item) => (
        <Composer.CommandItem key={item.value} value={item.value}>
          <Composer.CommandItemLabel>{item.label}</Composer.CommandItemLabel>
        </Composer.CommandItem>
      )}
    </Composer.CommandList>
  </Composer.Command>
);

describe("composer combobox a11y", () => {
  test("editor wires expanded/controls/activedescendant to a listbox of options", async () => {
    const store = Composer.createStore();
    const { container } = render(
      <Composer store={store} onSubmit={() => {}} commands={COMMANDS}>
        <Composer.Textarea aria-label="Message" />
        <CommandsHarness prefix="@" />
      </Composer>,
    );

    const textbox = screen.getByRole("textbox", { name: "Message" });

    // Closed: no descendant, no dangling controls reference.
    expect(textbox.getAttribute("aria-controls")).toBeNull();
    expect(textbox.getAttribute("aria-activedescendant")).toBeNull();
    expect(textbox.getAttribute("aria-autocomplete")).toBe("list");
    expect(textbox.getAttribute("aria-haspopup")).toBe("listbox");

    // Open the popup through the store mirror (the engine's channel).
    act(() => {
      store.setCommands({ active: true, trigger: "@", query: "" });
    });

    const listbox = screen.getByRole("listbox", { name: "Suggestions" });
    expect(textbox.getAttribute("aria-controls")).toBe(listbox.id);

    const options = screen.getAllByRole("option");
    expect(options.length).toBe(2);
    expect(options[0]?.getAttribute("aria-selected")).toBe("true");
    expect(options[0]?.getAttribute("tabindex")).toBe("-1");
    expect(textbox.getAttribute("aria-activedescendant")).toBe(options[0]?.id ?? null);

    // Highlight moves → activedescendant and aria-selected follow.
    act(() => {
      store.moveHighlight(1);
    });
    expect(options[1]?.getAttribute("aria-selected")).toBe("true");
    expect(options[0]?.getAttribute("aria-selected")).toBe("false");
    expect(textbox.getAttribute("aria-activedescendant")).toBe(options[1]?.id ?? null);

    await expectNoAxeViolations(container);

    // Close: everything collapses, nothing dangles.
    act(() => {
      store.setCommands({ active: false, trigger: null, query: "" });
    });
    expect(textbox.getAttribute("aria-controls")).toBeNull();
    expect(textbox.getAttribute("aria-activedescendant")).toBeNull();

    await expectNoAxeViolations(container);
    cleanup();
  });

  // Disabled options render with aria-disabled and stay perceivable, but the
  // highlight wrap skips them: arrows hop over, hover doesn't take, mousedown
  // doesn't select. Wrapping runs over the enabled subset only.
  test("disabled options are announced but skipped by highlight and selection", async () => {
    const store = Composer.createStore();
    const mixed: CommandItemData[] = [
      { value: "rasmus", label: "Rasmus" },
      { value: "maija", label: "Maija", disabled: true },
      { value: "ville", label: "Ville" },
    ];
    const { container } = render(
      <Composer
        store={store}
        onSubmit={() => {}}
        commands={{ "@": { kind: "insert", trigger: "word-boundary", items: mixed } }}
      >
        <Composer.Textarea aria-label="Message" />
        <CommandsHarness prefix="@" />
      </Composer>,
    );

    act(() => {
      store.setCommands({ active: true, trigger: "@", query: "" });
    });

    const textbox = screen.getByRole("textbox", { name: "Message" });
    const options = screen.getAllByRole("option");
    expect(options.length).toBe(3);
    expect(options[1]?.getAttribute("aria-disabled")).toBe("true");
    expect(options[1]?.hasAttribute("data-disabled")).toBe(true);
    expect(options[0]?.getAttribute("aria-disabled")).toBeNull();

    // Arrow down skips the disabled middle row; another wraps past it back to the top.
    expect(options[0]?.getAttribute("aria-selected")).toBe("true");
    act(() => {
      store.moveHighlight(1);
    });
    expect(options[2]?.getAttribute("aria-selected")).toBe("true");
    expect(options[1]?.getAttribute("aria-selected")).toBe("false");
    expect(textbox.getAttribute("aria-activedescendant")).toBe(options[2]?.id ?? null);
    act(() => {
      store.moveHighlight(1);
    });
    expect(options[0]?.getAttribute("aria-selected")).toBe("true");

    // Hover doesn't move the highlight onto a disabled row.
    fireEvent.mouseEnter(options[1] as HTMLElement);
    expect(options[0]?.getAttribute("aria-selected")).toBe("true");

    // Mousedown on a disabled row selects nothing and leaves the popup open.
    fireEvent.mouseDown(options[1] as HTMLElement);
    expect(screen.getByRole("listbox", { name: "Suggestions" })).toBeTruthy();
    expect(options[0]?.getAttribute("aria-selected")).toBe("true");

    await expectNoAxeViolations(container);
    cleanup();
  });

  // Regression: with several Commands mounted (playground: @ mentions + #
  // issues), an inactive sibling must not stomp activeOptionId back to null —
  // that ping-pongs against the active command's write forever
  // (max-update-depth crash).
  test("two mounted commands do not fight over aria-activedescendant", () => {
    const store = Composer.createStore();
    render(
      <Composer store={store} onSubmit={() => {}} commands={COMMANDS}>
        <Composer.Textarea aria-label="Message" />
        <CommandsHarness prefix="@" />
        <CommandsHarness prefix="#" />
      </Composer>,
    );

    act(() => {
      store.setCommands({ active: true, trigger: "#", query: "" });
    });

    const textbox = screen.getByRole("textbox", { name: "Message" });
    const options = screen.getAllByRole("option");
    expect(options.length).toBe(2);
    expect(textbox.getAttribute("aria-activedescendant")).toBe(options[0]?.id ?? null);

    // The other prefix takes over — the mirror follows the newly active list.
    act(() => {
      store.setCommands({ active: true, trigger: "@", query: "" });
    });
    expect(textbox.getAttribute("aria-activedescendant")).toContain("rasmus");

    cleanup();
  });
});
