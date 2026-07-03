import { describe, expect, test } from "bun:test";
import { interpretAskUserKey, interpretEditorKey } from "../src/composer/keyboard";

const baseContext = {
  isCommandListOpen: false,
  hasActiveAskUser: false,
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

  test("ask-user arrows take over when active", () => {
    const ctx = { ...baseContext, hasActiveAskUser: true };
    expect(interpretEditorKey({ key: "ArrowUp", shiftKey: false }, ctx)).toEqual({
      type: "ask-user-arrow",
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

describe("interpretAskUserKey", () => {
  const event = (key: string, extra: Partial<Parameters<typeof interpretAskUserKey>[0]> = {}) => ({
    key,
    ctrlKey: false,
    metaKey: false,
    altKey: false,
    defaultPrevented: false,
    ...extra,
  });

  test("escape dismisses regardless of highlight", () => {
    expect(interpretAskUserKey(event("Escape"), { hasHighlight: false })).toEqual({
      type: "dismiss-step",
    });
  });

  test("without highlight, other keys pass through", () => {
    expect(interpretAskUserKey(event("ArrowDown"), { hasHighlight: false })).toBeNull();
  });

  test("with highlight, arrows navigate and enter selects", () => {
    expect(interpretAskUserKey(event("ArrowDown"), { hasHighlight: true })).toEqual({
      type: "navigate-options",
      direction: 1,
    });
    expect(interpretAskUserKey(event("Enter"), { hasHighlight: true })).toEqual({
      type: "select-option",
    });
    expect(interpretAskUserKey(event("ArrowLeft"), { hasHighlight: true })).toEqual({
      type: "go-back",
    });
  });

  test("printable characters route back to the input", () => {
    expect(interpretAskUserKey(event("x"), { hasHighlight: true })).toEqual({
      type: "insert-character",
      character: "x",
    });
    expect(interpretAskUserKey(event("x", { metaKey: true }), { hasHighlight: true })).toBeNull();
  });

  test("defaultPrevented events are ignored", () => {
    expect(
      interpretAskUserKey(event("Escape", { defaultPrevented: true }), { hasHighlight: true }),
    ).toBeNull();
  });
});
