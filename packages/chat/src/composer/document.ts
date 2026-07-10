// Document — the TipTap side of the editor seam: conversions between the live
// editor and the wire formats (the opaque snapshot, the {text} submit payload
// with chips riding inline as chip: markdown tokens), and the RegisteredEditor
// adapter the mounted Textarea registers with the store.

import type { Editor } from "@tiptap/react";
import {
  type ChipData,
  type ChipIconKey,
  type ChipSegment,
  encodeChipMarkdown,
} from "../chip-markdown";
import { commandListPluginKey } from "./prefix-plugin";
import type { ComposerSnapshot, RegisteredEditor } from "./types";

// ---------------------------------------------------------------------------
// Chip segments → editor nodes. This module owns the mentionChip/paragraph
// node shapes, so the neutral wire segments become editor JSON here — not in
// chip-markdown, which stays schema-free.
// ---------------------------------------------------------------------------

export type InlineNodeJSON =
  | { type: "text"; text: string }
  | {
      type: "mentionChip";
      attrs: {
        prefix: string;
        value: string;
        label: string;
        icon?: ChipIconKey;
      };
    };

export type ParagraphNodeJSON = {
  type: "paragraph";
  content?: InlineNodeJSON[];
};

export const chipSegmentsToParagraphJSON = (
  segments: readonly ChipSegment[],
): ParagraphNodeJSON[] => {
  const paragraphs: ParagraphNodeJSON[] = [{ type: "paragraph", content: [] }];
  const pushInline = (node: InlineNodeJSON) => {
    const target = paragraphs.at(-1);
    if (!target) return;
    target.content = target.content ?? [];
    target.content.push(node);
  };

  for (const segment of segments) {
    if (segment.type === "text") {
      const lines = segment.text.split("\n");
      lines.forEach((line, lineIndex) => {
        if (lineIndex > 0) paragraphs.push({ type: "paragraph", content: [] });
        if (line.length > 0) pushInline({ type: "text", text: line });
      });
      continue;
    }
    pushInline({
      type: "mentionChip",
      attrs: {
        prefix: segment.prefix,
        value: segment.value,
        label: segment.label,
        ...(segment.icon ? { icon: segment.icon } : {}),
      },
    });
  }

  return paragraphs.filter((p) => (p.content?.length ?? 0) > 0);
};

export const snapshotFromEditor = (editor: Editor): ComposerSnapshot =>
  ({
    __pmDoc: editor.getJSON(),
    __brand: "ComposerSnapshot",
  }) as ComposerSnapshot;

export const applySnapshotToEditor = (editor: Editor, snapshot: ComposerSnapshot): void => {
  editor.commands.setContent(snapshot.__pmDoc as never);
};

// Minimal structural view of the document, so serialization is testable
// without a mounted editor.
type SerializableNode = {
  isText?: boolean;
  text?: string;
  type: { name: string };
  attrs?: Record<string, unknown>;
  forEach: (callback: (child: SerializableNode) => void) => void;
};

export const serializeDocument = (doc: SerializableNode): { text: string } => {
  const blocks: string[] = [];

  doc.forEach((block) => {
    if (block.type.name !== "paragraph") return;
    let inline = "";
    block.forEach((child) => {
      if (child.isText) {
        inline += child.text ?? "";
        return;
      }
      if (child.type.name !== "mentionChip") return;
      const attrs = (child.attrs ?? {}) as {
        prefix?: string;
        value?: string;
        label?: string;
        icon?: ChipIconKey | null;
      };
      inline += encodeChipMarkdown({
        prefix: attrs.prefix ?? "",
        value: attrs.value ?? "",
        label: attrs.label ?? "",
        icon: attrs.icon ?? undefined,
      });
    });
    blocks.push(inline);
  });

  return { text: blocks.join("\n") };
};

export const serializeEditorContent = (editor: Editor): { text: string } =>
  serializeDocument(editor.state.doc as unknown as SerializableNode);

// ---------------------------------------------------------------------------
// Command-commit helpers — the editor mutations a command selection performs
// (moved here from the command list, which now speaks RegisteredEditor).
// ---------------------------------------------------------------------------

// The active trigger's document range, read from the plugin's mirror. Falls
// back to the caret when the plugin has no active token.
const resolveTriggerRange = (editor: Editor): { from: number; to: number } => {
  const pluginState = commandListPluginKey.getState(editor.state);
  return {
    from: pluginState?.triggerStartPosition ?? 0,
    to: pluginState?.triggerEndPosition ?? editor.state.selection.$from.pos,
  };
};

// Replace the trigger range with a mention chip. Adds a trailing space so the
// user can keep typing — unless one already follows (mid-sentence mention), to
// avoid doubling it.
const insertMentionChip = (editor: Editor, chip: ChipData, range: { from: number; to: number }) => {
  const docEnd = editor.state.doc.content.size;
  const charAfter = range.to < docEnd ? editor.state.doc.textBetween(range.to, range.to + 1) : "";
  const chain = editor
    .chain()
    .focus()
    .deleteRange(range)
    .insertContentAt(range.from, {
      type: "mentionChip",
      attrs: {
        prefix: chip.prefix,
        label: chip.label,
        value: chip.value,
        icon: chip.icon ?? null,
      },
    });
  if (charAfter !== " ") chain.insertContent(" ");
  chain.run();
};

const closeCommandPopup = (editor: Editor) => {
  editor.view.dispatch(editor.state.tr.setMeta(commandListPluginKey, { close: true }));
};

// ---------------------------------------------------------------------------
// RegisteredEditor adapter — wraps a live TipTap instance into the
// engine-agnostic contract the store and the shared command list speak.
// ---------------------------------------------------------------------------

export const createTiptapRegisteredEditor = (editor: Editor): RegisteredEditor => ({
  focus: () => editor.commands.focus(),
  blur: () => editor.commands.blur(),
  clear: () => editor.commands.setContent(""),
  insertText: (text) => editor.commands.insertContent(text),
  insertChip: (chip) => editor.commands.insertContent({ type: "mentionChip", attrs: chip }),
  getText: () => editor.getText(),
  setText: (text) => editor.commands.setContent(text),
  serialize: () => serializeEditorContent(editor),
  isFocused: () => editor.isFocused,
  getRootElement: () => editor.view.dom,
  getSnapshot: () => snapshotFromEditor(editor),
  applySnapshot: (snapshot) => applySnapshotToEditor(editor, snapshot),
  insertChipAtTrigger: (chip) => insertMentionChip(editor, chip, resolveTriggerRange(editor)),
  deleteTrigger: () => {
    editor.chain().focus().deleteRange(resolveTriggerRange(editor)).run();
  },
  closeCommands: () => closeCommandPopup(editor),
  dismissCommands: () => {
    editor.view.focus();
    closeCommandPopup(editor);
  },
});
