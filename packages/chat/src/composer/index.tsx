"use client";

// Public surface of @intentface/chat/composer: the compound component plus
// the store/controller/hook building blocks.

import { ComposerActions, ComposerContextWindow, ComposerSubmit } from "./actions";
import {
  ComposerAskUser,
  ComposerAskUserContinue,
  ComposerAskUserDismiss,
  ComposerAskUserHints,
} from "./ask-user-parts";
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
  ComposerCommands,
} from "./command-list";
import { ComposerContainer } from "./container";
import { ComposerPanel, ComposerPanelItem } from "./panel";
import { ComposerPlaceholder } from "./placeholder";
import { ComposerProvider, ComposerRoot } from "./root";
import { ComposerTextarea } from "./textarea";

export const Composer = Object.assign(ComposerRoot, {
  Provider: ComposerProvider,
  Container: ComposerContainer,
  Attachments: ComposerAttachments,
  AttachmentTrigger: ComposerAttachmentTrigger,
  ContextWindow: ComposerContextWindow,
  Actions: ComposerActions,
  Placeholder: ComposerPlaceholder,
  Submit: ComposerSubmit,
  Panel: ComposerPanel,
  PanelItem: ComposerPanelItem,
  Textarea: ComposerTextarea,
  AskUser: ComposerAskUser,
  AskUserHints: ComposerAskUserHints,
  AskUserDismiss: ComposerAskUserDismiss,
  AskUserContinue: ComposerAskUserContinue,
  Commands: ComposerCommands,
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
export { composerController, useComposerController } from "./controller";
export type { ComposerEditorState } from "./document";
export { applySnapshotToEditor, serializeEditorContent, snapshotFromEditor } from "./document";
export { filterArrayItems, fuzzyScore } from "./fuzzy";
export { useComposerCommandsMap } from "./internals";
export type { EditorKeyAction, EditorKeyContext } from "./keyboard";
export { interpretAskUserKey, interpretEditorKey } from "./keyboard";
export type { MentionChipOptions } from "./mention-chip";
export { createMentionChipExtension } from "./mention-chip";
export type { ComposerPanelItemProps, ComposerPanelProps } from "./panel";
export type { ComposerPlaceholderProps } from "./placeholder";
export type { CommandListPluginState, RegisteredPrefix } from "./prefix-plugin";
export { CLOSED_COMMAND_STATE, commandListPluginKey, detectActivePrefix } from "./prefix-plugin";
export type { ComposerProviderProps, ComposerRootProps } from "./root";
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
export type { ComposerTextareaProps } from "./textarea";
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
