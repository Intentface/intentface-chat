"use client";

// Public surface of @intentface/chat/composer: the compound component plus
// the store/controller/hook building blocks.

import { ComposerActions, ComposerContextWindow, ComposerSubmit } from "./actions";
import { ComposerAttachments, ComposerAttachmentTrigger } from "./attachments";
import {
  ComposerCommand,
  ComposerCommandDismiss,
  ComposerCommandEmpty,
  ComposerCommandGroup,
  ComposerCommandGroupLabel,
  ComposerCommandItem,
  ComposerCommandItemDescription,
  ComposerCommandItemIcon,
  ComposerCommandItemLabel,
  ComposerCommandList,
  ComposerCommandLoading,
} from "./command-list";
import { ComposerContainer } from "./container";
import { ComposerPanel } from "./panel";
import { ComposerPlaceholder } from "./placeholder";
import { ComposerPopover } from "./popover";
import { ComposerRoot } from "./root";
import { createComposerStore } from "./store";
import { ComposerTextarea } from "./textarea";
import { ComposerTextareaLegacy } from "./textarea-legacy";

export const Composer = Object.assign(ComposerRoot, {
  /** Create a standalone store handle: <Composer store={…}> + useComposerStore(store, selector) + store.controller for imperative access. */
  createStore: createComposerStore,
  Container: ComposerContainer,
  Attachments: ComposerAttachments,
  AttachmentTrigger: ComposerAttachmentTrigger,
  ContextWindow: ComposerContextWindow,
  Actions: ComposerActions,
  Placeholder: ComposerPlaceholder,
  Submit: ComposerSubmit,
  Panel: ComposerPanel,
  Popover: ComposerPopover,
  Textarea: ComposerTextarea,
  /** The TipTap-based editor, kept for side-by-side comparison until the swap PR removes it. */
  TextareaLegacy: ComposerTextareaLegacy,
  Command: ComposerCommand,
  CommandList: ComposerCommandList,
  CommandLoading: ComposerCommandLoading,
  CommandEmpty: ComposerCommandEmpty,
  CommandDismiss: ComposerCommandDismiss,
  CommandItem: ComposerCommandItem,
  CommandItemIcon: ComposerCommandItemIcon,
  CommandItemLabel: ComposerCommandItemLabel,
  CommandItemDescription: ComposerCommandItemDescription,
  CommandGroup: ComposerCommandGroup,
  CommandGroupLabel: ComposerCommandGroupLabel,
});

export type { ComposerSubmitState, UseComposerSubmitOptions } from "./actions";
export { useComposerSubmit } from "./actions";
export type { ComposerAttachmentsProps, ComposerAttachmentTriggerProps } from "./attachments";
export type { CommandListState, ComposerCommandProps } from "./command-list";
export { useCommandListItems } from "./command-list";
export type { ComposerContainerProps } from "./container";
export { useComposerController } from "./controller";
export {
  applySnapshotToEditor,
  createTiptapRegisteredEditor,
  serializeEditorContent,
  snapshotFromEditor,
} from "./document";
export { filterArrayItems, fuzzyScore } from "./fuzzy";
export type { EditorKeyAction, EditorKeyContext } from "./keyboard";
export { interpretAskUserKey, interpretEditorKey } from "./keyboard";
export type { MentionChipOptions } from "./mention-chip";
export { createMentionChipExtension } from "./mention-chip";
export type { ComposerPanelProps } from "./panel";
export type { ComposerPlaceholderProps } from "./placeholder";
export type { ComposerPopoverProps } from "./popover";
export type { CommandListPluginState, RegisteredPrefix } from "./prefix-detection";
export { CLOSED_COMMAND_STATE, detectActivePrefix } from "./prefix-detection";
export { commandListPluginKey } from "./prefix-plugin";
export type { ComposerRootProps } from "./root";
export type { Segment, SegmentDoc, TextChange } from "./segments";
export {
  documentLength,
  getPlainText,
  serializeSegments,
  sliceSegments,
  spliceSegments,
} from "./segments";
export type {
  ComposerAskUserState,
  ComposerAttachmentsState,
  ComposerCommandsState,
  ComposerEditorState,
  ComposerPanelSlice,
  ComposerState,
  ComposerStore,
} from "./store";
export { useComposer, useComposerStore } from "./store";
export type { ComposerTextareaProps, ComposerTextareaState } from "./textarea";
export type { ComposerTextareaLegacyProps } from "./textarea-legacy";
export type {
  AskUserOption,
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
  RegisteredEditor,
  TriggerRule,
} from "./types";
export type {
  ComposerEditableProps,
  UseComposerEditorOptions,
  UseComposerEditorResult,
} from "./use-composer-editor";
export { useComposerEditor } from "./use-composer-editor";
