"use client";

// Composer.Textarea — the TipTap editor. All editing behavior lives here:
// chip paste handling, the command-prefix plugin, keyboard interpretation,
// store mirroring, controlled/uncontrolled text. No styling crosses this
// boundary — the editor element and the command decorations expose data
// attributes (data-slot="composer-editor", data-command-badge,
// data-command-placeholder) for the styled layer's CSS.

import Document from "@tiptap/extension-document";
import Paragraph from "@tiptap/extension-paragraph";
import Text from "@tiptap/extension-text";
import { TextSelection } from "@tiptap/pm/state";
import { EditorContent, useEditor } from "@tiptap/react";
import { type ReactNode, useCallback, useEffect, useLayoutEffect, useMemo } from "react";
import { type ChipData, chipSegmentsToParagraphJSON, parseChipSegments } from "../chip-markdown";
import type { PrimitiveProps } from "../internal/primitive-props";
import { useRenderElement } from "../internal/render/useRenderElement";
import { useAsRef, useComposerInternals } from "./internals";
import { interpretEditorKey } from "./keyboard";
import { createMentionChipExtension } from "./mention-chip";
import { commandListPluginKey } from "./prefix-plugin";
import { useComposer, useComposerContextStore } from "./store";

export type ComposerTextareaState = {
  /** Present as data-disabled while the editor is non-editable. */
  disabled: boolean;
  /** Present as data-filled while the editor has content. */
  filled: boolean;
};

export type ComposerTextareaProps = Omit<
  PrimitiveProps<"div", ComposerTextareaState>,
  "children"
> & {
  value?: string;
  onValueChange?: (text: string) => void;
  disabled?: boolean;
  autoFocus?: boolean;
  /** Custom renderer for committed chips in the editor. Defaults to a label-only Chip. */
  renderChip?: (chip: ChipData) => ReactNode;
  /** Placeholder overlay content, shown while the editor is empty. */
  children?: ReactNode;
};

export const ComposerTextarea = ({
  value,
  onValueChange,
  className,
  render,
  style,
  disabled = false,
  autoFocus = false,
  renderChip,
  children,
  ...elementProps
}: ComposerTextareaProps) => {
  const store = useComposerContextStore();
  const hasContent = useComposer((composer) => composer.textarea.hasContent);
  const { getRegisteredPrefixes, reportEditorUpdate } = useComposerInternals();

  const isControlled = value !== undefined;

  const onValueChangeRef = useAsRef(onValueChange);
  const renderChipRef = useAsRef(renderChip);

  // Single-select questions clear their selection once the user starts typing
  // a free-text answer. Stable across renders — event-time reads go through
  // the store, so no subscription is needed.
  const clearSelectionsIfSingle = useCallback(() => {
    const { askUser } = store.getSnapshot();
    if (!askUser.questions) return;
    const currentQuestion = askUser.questions[askUser.step];
    if (!currentQuestion?.multiSelect) {
      askUser.clearSelections();
    }
  }, [store]);

  const mentionExtension = useMemo(
    () =>
      createMentionChipExtension({
        getRegisteredPrefixes,
        get renderChip() {
          return renderChipRef.current;
        },
      }),
    [getRegisteredPrefixes],
  );

  const tiptapEditor = useEditor({
    immediatelyRender: false,
    extensions: [Document, Paragraph, Text, mentionExtension],
    content: isControlled ? value : "",
    editorProps: {
      attributes: {
        "data-slot": "composer-editor",
        spellcheck: "false",
      },
      handlePaste: (_view, event) => {
        const items = event.clipboardData?.items;
        if (items) {
          const files = [...items]
            .filter((item) => item.kind === "file")
            .map((item) => item.getAsFile())
            .filter((file): file is File => Boolean(file));

          if (files.length) {
            event.preventDefault();
            store.getSnapshot().attachments.add(files);
            return true;
          }
        }

        const pastedText = event.clipboardData?.getData("text/plain");
        if (!pastedText || !pastedText.includes("(chip:")) return false;

        const segments = parseChipSegments(pastedText);
        if (!segments.some((segment) => segment.type === "chip")) return false;

        const editor = store.editorRef.current;
        if (!editor) return false;

        const paragraphs = chipSegmentsToParagraphJSON(segments);
        if (paragraphs.length === 0) return false;

        event.preventDefault();
        editor.commands.insertContent(paragraphs);
        return true;
      },
      handleKeyDown: (view, event) => {
        const commandState = commandListPluginKey.getState(view.state);
        const action = interpretEditorKey(
          { key: event.key, shiftKey: event.shiftKey },
          {
            isCommandListOpen: commandState?.isOpen ?? false,
            hasActiveAskUser: (store.getSnapshot().askUser.questions?.length ?? 0) > 0,
            isEditorEmpty: view.state.doc.textContent === "",
            hasAttachments: store.getSnapshot().attachments.items.length > 0,
          },
        );

        if (!action) return false;

        switch (action.type) {
          case "command-select": {
            event.preventDefault();
            store.commandSelectRef.current?.();
            return true;
          }
          case "command-close": {
            event.preventDefault();
            view.dispatch(view.state.tr.setMeta(commandListPluginKey, { close: true }));
            return true;
          }
          case "command-navigate": {
            event.preventDefault();
            store.moveHighlight(action.direction);
            return true;
          }
          case "command-caret": {
            // Trap the caret inside the active token: clamp Left/Right to the
            // token range so it can't leave while the popup is open (Escape /
            // Dismiss is the only way out).
            event.preventDefault();
            if (commandState?.isOpen) {
              const { triggerStartPosition, triggerEndPosition } = commandState;
              const current = view.state.selection.from;
              const target = Math.min(
                Math.max(current + action.direction, triggerStartPosition),
                triggerEndPosition,
              );
              if (target !== current) {
                view.dispatch(
                  view.state.tr.setSelection(TextSelection.create(view.state.doc, target)),
                );
              }
            }
            return true;
          }
          case "ask-user-arrow": {
            event.preventDefault();
            const optionsHandle = store.getSnapshot().askUser.optionsRef.current;
            optionsHandle?.navigate(action.direction);
            view.dom.blur();
            return true;
          }
          case "remove-last-attachment": {
            event.preventDefault();
            const { items, remove } = store.getSnapshot().attachments;
            const lastItem = items.at(-1);
            if (lastItem) remove(lastItem.id);
            return true;
          }
          case "submit-form": {
            event.preventDefault();
            const form = (event.target as HTMLElement).closest("form");
            if (form) form.requestSubmit();
            return true;
          }
          case "soft-break": {
            const { state, dispatch } = view;
            dispatch(state.tr.split(state.selection.$from.pos));
            return true;
          }
        }
      },
    },
    onFocus: () => {
      store.getSnapshot().askUser.optionsRef.current?.clearHighlight();
    },
    onMount: ({ editor: instance }) => {
      store.editorRef.current = instance;
    },
    onUnmount: () => {
      store.editorRef.current = null;
    },
    onUpdate: ({ editor: instance }) => {
      const text = instance.getText();
      store.setHasContent(text.trim().length > 0 || !instance.isEmpty);
      if (text.trim().length > 0) {
        clearSelectionsIfSingle();
        store.getSnapshot().askUser.optionsRef.current?.clearHighlight();
      }
      onValueChangeRef.current?.(text);
      reportEditorUpdate(instance);
    },
    // Command state changes on selection and meta-only transactions too (caret
    // moving inside the token, Escape / Dismiss closing it), not just on doc
    // edits — so mirror it from onTransaction, which fires for every kind.
    // setCommands no-ops when nothing changed, so this stays cheap.
    onTransaction: ({ editor: instance }) => {
      const pluginState = commandListPluginKey.getState(instance.state);
      store.setCommands({
        isOpen: pluginState?.isOpen ?? false,
        trigger: pluginState?.trigger ?? null,
        query: pluginState?.query ?? "",
      });
    },
    editable: !disabled,
    autofocus: autoFocus,
  });

  // setContent emits an update (tiptap v3 default), so onUpdate keeps
  // hasContent in sync — no manual write needed.
  useEffect(() => {
    if (isControlled && tiptapEditor && value !== tiptapEditor.getText()) {
      tiptapEditor.commands.setContent(value);
    }
  }, [value, tiptapEditor, isControlled]);

  // Register the live editor with the store's controller (cleanup on unmount).
  useLayoutEffect(() => {
    if (!tiptapEditor) return;
    return store.registerEditor(tiptapEditor);
  }, [store, tiptapEditor]);

  const editorContent =
    tiptapEditor !== null ? (
      <EditorContent editor={tiptapEditor} style={{ position: "relative" }}>
        {!hasContent && children && (
          <div
            data-slot="composer-placeholder"
            style={{ position: "absolute", inset: 0, pointerEvents: "none" }}
            aria-hidden="true"
          >
            {children}
          </div>
        )}
      </EditorContent>
    ) : null;

  return useRenderElement(
    "div",
    { className, render, style },
    {
      state: { disabled, filled: hasContent },
      props: [{ "data-slot": "composer-textarea", children: editorContent }, elementProps],
    },
  );
};
