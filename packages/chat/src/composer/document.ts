// Document — conversions between the live TipTap editor and the wire formats:
// the opaque snapshot (ProseMirror JSON) and the {text} submit payload (chips
// ride inline in the text as chip: markdown tokens). Also builds the
// editor-bound imperative controller, since every controller operation is a
// document operation.

import type { Editor } from "@tiptap/react";
import type { RefObject } from "react";
import { type ChipIconKey, encodeChipMarkdown } from "../chip-markdown";
import type { ComposerEditorHandle, ComposerSnapshot } from "./types";

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

// The single ComposerEditorHandle implementation plus the read/serialize
// operations internal callers need — a null-safe port over the store's
// registered editor instance.
export type ComposerEditorState = ComposerEditorHandle & {
  getText: () => string;
  setText: (text: string) => void;
  serialize: () => { text: string };
  ensureFocus: () => void;
};

export const createEditorController = (
  editorRef: RefObject<Editor | null>,
): ComposerEditorState => ({
  focus: () => editorRef.current?.commands.focus(),
  blur: () => editorRef.current?.commands.blur(),
  clear: () => editorRef.current?.commands.setContent(""),
  insertText: (text) => editorRef.current?.commands.insertContent(text),
  insertChip: (chip) =>
    editorRef.current?.commands.insertContent({ type: "mentionChip", attrs: chip }),
  getText: () => editorRef.current?.getText() ?? "",
  setText: (text) => editorRef.current?.commands.setContent(text),
  serialize: () => (editorRef.current ? serializeEditorContent(editorRef.current) : { text: "" }),
  ensureFocus: () => {
    const editor = editorRef.current;
    if (editor && !editor.isFocused) editor.commands.focus();
  },
});
