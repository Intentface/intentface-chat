"use client";

// Imperative composer access. `composerController` is the back-compat
// singleton handle bound lazily to the page-global store (drive the composer
// from toolbars, thread actions — anywhere outside the tree).
// `useComposerController()` resolves the nearest Composer.Root's store and is
// what multi-instance pages (docs previews) should use.

import type { ComposerEditorState } from "./document";
import { getGlobalComposerStore, useComposerStore } from "./store";

export type { ComposerEditorState };

// Lazily delegates every call to the global store's controller, so importing
// this module never creates the store during SSR module init.
export const composerController: ComposerEditorState = {
  focus: () => getGlobalComposerStore().controller.focus(),
  blur: () => getGlobalComposerStore().controller.blur(),
  clear: () => getGlobalComposerStore().controller.clear(),
  insertText: (text) => getGlobalComposerStore().controller.insertText(text),
  insertChip: (chip) => getGlobalComposerStore().controller.insertChip(chip),
  getText: () => getGlobalComposerStore().controller.getText(),
  setText: (text) => getGlobalComposerStore().controller.setText(text),
  serialize: () => getGlobalComposerStore().controller.serialize(),
  ensureFocus: () => getGlobalComposerStore().controller.ensureFocus(),
};

export const useComposerController = (): ComposerEditorState => useComposerStore().controller;
