"use client";

// Imperative composer access from inside the tree. From outside it, the
// Composer.createStore() handle carries the same surface directly:
// store.controller.focus() — no hook, no context.

import { type ComposerEditorState, useComposerContextStore } from "./store";

export type { ComposerEditorState };

export const useComposerController = (): ComposerEditorState =>
  useComposerContextStore().controller;
