"use client";

// Public surface of @intentface/chat/composer. Stage A ships the types, store,
// controller, and machine/plugin building blocks; the compound component parts
// assemble on top of these.
// stage B: compound parts (Composer = Object.assign(Root, { ... })).

export { composerController, useComposerController } from "./controller";
export type { ComposerEditorState } from "./document";
export {
  applySnapshotToEditor,
  serializeEditorContent,
  snapshotFromEditor,
} from "./document";
export { filterArrayItems, fuzzyScore } from "./fuzzy";
export type { EditorKeyAction, EditorKeyContext } from "./keyboard";
export { interpretAskUserKey, interpretEditorKey } from "./keyboard";
export type { MentionChipOptions } from "./mention-chip";
export { createMentionChipExtension } from "./mention-chip";
export type { CommandListPluginState, RegisteredPrefix } from "./prefix-plugin";
export {
  CLOSED_COMMAND_STATE,
  commandListPluginKey,
  detectActivePrefix,
} from "./prefix-plugin";
export type {
  ComposerAskUserState,
  ComposerAttachmentsState,
  ComposerCommandsState,
  ComposerPanelState,
  ComposerState,
  ComposerStore,
} from "./store";
export {
  ComposerStoreContext,
  createComposerStore,
  getGlobalComposerStore,
  useComposer,
  useComposerStore,
} from "./store";
export type {
  AskUserQuestion,
  AttachmentsApi,
  ChipData,
  CommandItemData,
  CommandItemKind,
  ComposerAnswerEntry,
  ComposerAnswersSubmit,
  ComposerCommandsConfig,
  ComposerCommandsItems,
  ComposerCommandsMap,
  ComposerEditorHandle,
  ComposerMessageSubmit,
  ComposerSnapshot,
  ComposerSubmitData,
  PrefixOnSelectContext,
  TriggerRule,
} from "./types";
