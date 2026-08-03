import { describe, expect, test } from "bun:test";
import { createComposerStore } from "../src/composer/store";
import type { RegisteredEditor } from "../src/composer/types";

// The store's controller is a null-safe port over whatever RegisteredEditor is
// currently mounted: before registration and after cleanup every call no-ops
// (or returns an empty value); while registered, calls delegate to the engine.

const createFakeEditor = (
  overrides: Partial<RegisteredEditor> = {},
): {
  editor: RegisteredEditor;
  calls: string[];
} => {
  const calls: string[] = [];
  const record =
    (name: string) =>
    (..._args: unknown[]) => {
      calls.push(name);
    };
  const editor: RegisteredEditor = {
    focus: record("focus"),
    blur: record("blur"),
    clear: record("clear"),
    insertText: record("insertText"),
    insertChip: record("insertChip"),
    getText: () => "hello",
    setText: record("setText"),
    serialize: () => ({ text: "hello @world" }),
    isFocused: () => false,
    getRootElement: () => null,
    getSnapshot: () => ({ __doc: {}, __brand: "ComposerSnapshot" }) as never,
    applySnapshot: record("applySnapshot"),
    insertChipAtTrigger: record("insertChipAtTrigger"),
    deleteTrigger: record("deleteTrigger"),
    closeCommands: record("closeCommands"),
    dismissCommands: record("dismissCommands"),
    ...overrides,
  };
  return { editor, calls };
};

describe("composer store: editor registration", () => {
  test("controller no-ops safely before any editor registers", () => {
    const store = createComposerStore();
    expect(store.controller.getText()).toBe("");
    expect(store.controller.serialize()).toEqual({ text: "" });
    expect(() => {
      store.controller.focus();
      store.controller.clear();
      store.controller.ensureFocus();
    }).not.toThrow();
  });

  test("controller delegates to the registered editor", () => {
    const store = createComposerStore();
    const { editor, calls } = createFakeEditor();
    store.registerEditor(editor);

    expect(store.controller.getText()).toBe("hello");
    expect(store.controller.serialize()).toEqual({ text: "hello @world" });
    store.controller.insertText("!");
    store.controller.setText("reset");
    expect(calls).toEqual(["insertText", "setText"]);
  });

  test("ensureFocus focuses only while the editor is unfocused", () => {
    const store = createComposerStore();
    const unfocused = createFakeEditor({ isFocused: () => false });
    store.registerEditor(unfocused.editor);
    store.controller.ensureFocus();
    expect(unfocused.calls).toEqual(["focus"]);

    const focused = createFakeEditor({ isFocused: () => true });
    store.registerEditor(focused.editor);
    store.controller.ensureFocus();
    expect(focused.calls).toEqual([]);
  });

  test("unregister cleanup releases only its own registration", () => {
    const store = createComposerStore();
    const first = createFakeEditor({ getText: () => "first" });
    const second = createFakeEditor({ getText: () => "second" });

    const unregisterFirst = store.registerEditor(first.editor);
    store.registerEditor(second.editor);

    // A stale cleanup (first) must not evict the editor that replaced it.
    unregisterFirst();
    expect(store.controller.getText()).toBe("second");
  });

  test("controller returns to no-op after the active editor unregisters", () => {
    const store = createComposerStore();
    const { editor } = createFakeEditor();
    const unregister = store.registerEditor(editor);
    unregister();
    expect(store.controller.getText()).toBe("");
    expect(store.controller.serialize()).toEqual({ text: "" });
  });
});
