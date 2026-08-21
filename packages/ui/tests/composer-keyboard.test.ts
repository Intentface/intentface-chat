import { describe, expect, test } from "bun:test";
import { interpretEditorKey, interpretRequestKey } from "../src/composer/keyboard";

const baseContext = {
  isCommandListOpen: false,
  hasActiveRequests: false,
  isEditorEmpty: false,
  hasAttachments: false,
};

describe("interpretEditorKey", () => {
  test("command list captures navigation and selection", () => {
    const ctx = { ...baseContext, isCommandListOpen: true };
    expect(interpretEditorKey({ key: "Tab", shiftKey: false }, ctx)).toEqual({
      type: "command-select",
    });
    expect(interpretEditorKey({ key: "ArrowDown", shiftKey: false }, ctx)).toEqual({
      type: "command-navigate",
      direction: 1,
    });
    expect(interpretEditorKey({ key: "Escape", shiftKey: false }, ctx)).toEqual({
      type: "command-close",
    });
    expect(interpretEditorKey({ key: "Enter", shiftKey: false }, ctx)).toEqual({
      type: "command-select",
    });
  });

  test("request arrows take over when active", () => {
    const ctx = { ...baseContext, hasActiveRequests: true };
    expect(interpretEditorKey({ key: "ArrowUp", shiftKey: false }, ctx)).toEqual({
      type: "request-arrow",
      direction: -1,
    });
  });

  test("backspace on empty editor with attachments removes the last one", () => {
    const ctx = { ...baseContext, isEditorEmpty: true, hasAttachments: true };
    expect(interpretEditorKey({ key: "Backspace", shiftKey: false }, ctx)).toEqual({
      type: "remove-last-attachment",
    });
  });

  test("enter submits, shift+enter soft-breaks", () => {
    expect(interpretEditorKey({ key: "Enter", shiftKey: false }, baseContext)).toEqual({
      type: "submit-form",
    });
    expect(interpretEditorKey({ key: "Enter", shiftKey: true }, baseContext)).toEqual({
      type: "soft-break",
    });
  });

  test("unhandled keys return null", () => {
    expect(interpretEditorKey({ key: "a", shiftKey: false }, baseContext)).toBeNull();
  });
});

describe("interpretRequestKey", () => {
  const event = (key: string, extra: Partial<Parameters<typeof interpretRequestKey>[0]> = {}) => ({
    key,
    ctrlKey: false,
    metaKey: false,
    altKey: false,
    defaultPrevented: false,
    ...extra,
  });

  test("escape dismisses regardless of highlight", () => {
    expect(interpretRequestKey(event("Escape"), { hasHighlight: false })).toEqual({
      type: "dismiss-step",
    });
  });

  test("without highlight, other keys pass through", () => {
    expect(interpretRequestKey(event("ArrowDown"), { hasHighlight: false })).toBeNull();
  });

  test("with highlight, arrows navigate and enter selects", () => {
    expect(interpretRequestKey(event("ArrowDown"), { hasHighlight: true })).toEqual({
      type: "navigate-options",
      direction: 1,
    });
    expect(interpretRequestKey(event("Enter"), { hasHighlight: true })).toEqual({
      type: "select-option",
    });
    expect(interpretRequestKey(event("ArrowLeft"), { hasHighlight: true })).toEqual({
      type: "go-back",
    });
  });

  test("printable characters route back to the input", () => {
    expect(interpretRequestKey(event("x"), { hasHighlight: true })).toEqual({
      type: "insert-character",
      character: "x",
    });
    expect(interpretRequestKey(event("x", { metaKey: true }), { hasHighlight: true })).toBeNull();
  });

  test("defaultPrevented events are ignored", () => {
    expect(
      interpretRequestKey(event("Escape", { defaultPrevented: true }), { hasHighlight: true }),
    ).toBeNull();
  });
});

describe("interpretEditorKey: submitOn", () => {
  const inverted = { ...baseContext, submitOn: "shift-enter" as const };

  test("shift-enter mode swaps the chord mapping", () => {
    expect(interpretEditorKey({ key: "Enter", shiftKey: true }, inverted)).toEqual({
      type: "submit-form",
    });
    expect(interpretEditorKey({ key: "Enter", shiftKey: false }, inverted)).toEqual({
      type: "soft-break",
    });
  });

  test("an open command list still owns plain Enter (select) in shift-enter mode", () => {
    expect(
      interpretEditorKey(
        { key: "Enter", shiftKey: false },
        { ...inverted, isCommandListOpen: true },
      ),
    ).toEqual({ type: "command-select" });
  });

  test("the send chord never submits while the command list is open", () => {
    // Default mode: Shift+Enter (non-send) soft-breaks — unchanged.
    expect(
      interpretEditorKey(
        { key: "Enter", shiftKey: true },
        { ...baseContext, isCommandListOpen: true },
      ),
    ).toEqual({ type: "soft-break" });
    // Inverted mode: Shift+Enter is the send chord, but the popup suppresses it.
    expect(
      interpretEditorKey(
        { key: "Enter", shiftKey: true },
        { ...inverted, isCommandListOpen: true },
      ),
    ).toEqual({ type: "soft-break" });
  });
});

describe("interpretRequestKey: Space selects", () => {
  test("Space toggles the highlighted option (APG radio/checkbox)", () => {
    expect(
      interpretRequestKey(
        { key: " ", ctrlKey: false, metaKey: false, altKey: false, defaultPrevented: false },
        { hasHighlight: true },
      ),
    ).toEqual({ type: "select-option" });
  });
});

describe("interpretEditorKey: request dismiss", () => {
  test("editor-focused Escape dismisses the active question", () => {
    expect(
      interpretEditorKey(
        { key: "Escape", shiftKey: false },
        { ...baseContext, hasActiveRequests: true },
      ),
    ).toEqual({ type: "request-dismiss" });
  });

  test("command list still owns Escape when both are active", () => {
    expect(
      interpretEditorKey(
        { key: "Escape", shiftKey: false },
        { ...baseContext, hasActiveRequests: true, isCommandListOpen: true },
      ),
    ).toEqual({ type: "command-close" });
  });
});
