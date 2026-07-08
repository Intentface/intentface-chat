"use client";

// Public surface of @intentface/chat/composer: the compound component plus
// the store/controller/hook building blocks.

import { ComposerActions, ComposerContextWindow, ComposerSubmit } from "./actions";
import { ComposerAttachments, ComposerAttachmentTrigger } from "./attachments";
import {
  ComposerCommandCollection,
  ComposerCommandDismiss,
  ComposerCommandEmpty,
  ComposerCommandGroup,
  ComposerCommandGroupLabel,
  ComposerCommandItem,
  ComposerCommandItemDescription,
  ComposerCommandItemIcon,
  ComposerCommandItemLabel,
  ComposerCommandItems,
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
  CommandList: ComposerCommandList,
  CommandItems: ComposerCommandItems,
  CommandLoading: ComposerCommandLoading,
  CommandEmpty: ComposerCommandEmpty,
  CommandDismiss: ComposerCommandDismiss,
  CommandItem: ComposerCommandItem,
  CommandItemIcon: ComposerCommandItemIcon,
  CommandItemLabel: ComposerCommandItemLabel,
  CommandItemDescription: ComposerCommandItemDescription,
  CommandGroup: ComposerCommandGroup,
  CommandGroupLabel: ComposerCommandGroupLabel,
  CommandCollection: ComposerCommandCollection,
});

export type { ComposerSubmitState, UseComposerSubmitOptions } from "./actions";
export { useComposerSubmit } from "./actions";
export type { ComposerAttachmentsProps, ComposerAttachmentTriggerProps } from "./attachments";
export type { CommandListState, ComposerCommandListProps } from "./command-list";
export { useCommandListItems } from "./command-list";
export type { ComposerContainerProps } from "./container";
export { useComposerController } from "./controller";
export type { ComposerEditorState } from "./document";
export { applySnapshotToEditor, serializeEditorContent, snapshotFromEditor } from "./document";
export { filterArrayItems, fuzzyScore } from "./fuzzy";
export type { EditorKeyAction, EditorKeyContext } from "./keyboard";
export { interpretAskUserKey, interpretEditorKey } from "./keyboard";
export type { MentionChipOptions } from "./mention-chip";
export { createMentionChipExtension } from "./mention-chip";
export type { ComposerPanelProps } from "./panel";
export type { ComposerPlaceholderProps } from "./placeholder";
export type { ComposerPopoverProps } from "./popover";
export type { CommandListPluginState, RegisteredPrefix } from "./prefix-plugin";
export { CLOSED_COMMAND_STATE, commandListPluginKey, detectActivePrefix } from "./prefix-plugin";
export type { ComposerRootProps } from "./root";
export type {
  ComposerAskUserState,
  ComposerAttachmentsState,
  ComposerCommandsState,
  ComposerPanelSlice,
  ComposerState,
  ComposerStore,
} from "./store";
export { useComposer, useComposerStore } from "./store";
export type { ComposerTextareaProps } from "./textarea";
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
  TriggerRule,
} from "./types";
