import type { Editor } from "@tiptap/react";
import type { RefObject } from "react";
import type { ComposerEditorHandle } from "@/components/ai/composer";

// One Composer per page → a single registered editor ref.
let activeEditorRef: RefObject<Editor | null> | null = null;

// Registered by ComposerRoot on mount; returns the unregister cleanup.
export const registerComposerController = (ref: RefObject<Editor | null>) => {
  activeEditorRef = ref;
  return () => {
    if (activeEditorRef === ref) activeEditorRef = null;
  };
};

const editor = () => activeEditorRef?.current ?? null;

// The single ComposerEditorHandle implementation. Stable and null-safe, callable
// from anywhere — inside or outside the Composer tree.
export const composerController: ComposerEditorHandle = {
  focus: () => editor()?.commands.focus(),
  blur: () => editor()?.commands.blur(),
  clear: () => editor()?.commands.setContent(""),
  insertText: (text) => editor()?.commands.insertContent(text),
  insertChip: (chip) =>
    editor()?.commands.insertContent({ type: "mentionChip", attrs: chip }),
};

export const useComposerController = () => composerController;
