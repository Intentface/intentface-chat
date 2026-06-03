"use client";

import { mergeAttributes, Node as TiptapNode } from "@tiptap/core";
import Document from "@tiptap/extension-document";
import Paragraph from "@tiptap/extension-paragraph";
import Text from "@tiptap/extension-text";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";
import {
  type Editor,
  EditorContent,
  NodeViewWrapper,
  ReactNodeViewRenderer,
  useEditor,
} from "@tiptap/react";
import type { FileUIPart } from "ai";
import { AnimatePresence, MotionConfig, motion } from "motion/react";
import {
  type ChangeEvent,
  Children,
  type ComponentProps,
  createContext,
  Fragment,
  isValidElement,
  type ReactNode,
  type RefObject,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { AskUser, type AskUserOptionsHandle } from "@/components/ai/ask-user";
import {
  type AttachmentItem,
  Attachments,
  DEFAULT_ATTACHMENT_ACCEPT,
  DEFAULT_ATTACHMENT_MAX_FILE_SIZE,
  DEFAULT_ATTACHMENT_MAX_FILES,
  matchesAccept,
  prepareAttachmentsForSend,
  revokeAllAttachmentUrls,
  revokeAttachmentUrl,
  toAttachmentItem,
} from "@/components/ai/attachments";
import { Chip, type ChipVariant } from "@/components/ai/chip";
import { Commands } from "@/components/ai/commands";
import { SendIcon } from "@/components/icons/send";
import Button from "@/components/ui/button";
import { IconButton } from "@/components/ui/icon-button";
import { Kbd } from "@/components/ui/kbd";
import { useLoop } from "@/hooks/use-loop";
import { useMeasure } from "@/hooks/use-measure";
import { CHIP_ICONS, type ChipIconKey } from "@/lib/ai/chip-icons";
import {
  chipSegmentsToParagraphJSON,
  encodeChipMarkdown,
  parseChipSegments,
} from "@/lib/ai/chip-markdown";
import { cn } from "@/lib/utils";
import type { AskUserQuestion } from "@/tools/ask-user";

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export type CommandItemKind = "insert" | "execute";

export type TriggerRule = "doc-start" | "after-whitespace";

export type ChipData = {
  prefix: string;
  value: string;
  label: string;
  icon?: ChipIconKey;
  variant?: ChipVariant;
};

export type ComposerEditorHandle = {
  focus: () => void;
  blur: () => void;
  clear: () => void;
  insertText: (text: string) => void;
  insertChip: (chip: ChipData) => void;
};

export type AttachmentsApi = {
  add: (files: File[] | FileList) => void;
  remove: (id: string) => void;
  openFileDialog: () => void;
};

export type PrefixOnSelectContext = {
  editor: ComposerEditorHandle;
  attachments: AttachmentsApi;
};

export type CommandItemData = {
  value: string;
  label: string;
  description?: string;
  icon?: ChipIconKey;
  variant?: ChipVariant;
  keywords?: string;
  onSelect?: (context: PrefixOnSelectContext) => void;
};

export type ComposerSnapshot = {
  readonly __pmDoc: object;
  readonly __brand: "ComposerSnapshot";
};

export type ComposerMessageSubmit = {
  kind: "message";
  text: string;
  files: FileUIPart[];
  chips: ChipData[];
};

export type ComposerAnswerEntry =
  | { question: string; option: string }
  | { question: string; text: string }
  | { question: string; options: string[]; text: string }
  | { question: string };

export type ComposerAnswersSubmit = {
  kind: "answers";
  answers: ComposerAnswerEntry[];
};

export type ComposerSubmitData = ComposerMessageSubmit | ComposerAnswersSubmit;

export type ComposerCommandsItems =
  | CommandItemData[]
  | ((
      query: string,
      options: { signal: AbortSignal },
    ) => CommandItemData[] | Promise<CommandItemData[]>);

export type ComposerCommandsConfig = {
  kind: CommandItemKind;
  trigger: TriggerRule;
  items: ComposerCommandsItems;
};

export type ComposerCommandsMap = Record<string, ComposerCommandsConfig>;

// ===========================================================================
// Internal engine
//
// Everything from here to the Context section is the Composer's own logic —
// document (de)serialization, the editor controller, the command-list plugin,
// keyboard interpreters, and the ask-user / attachment state machines. It is
// inlined (rather than split into modules) so the component ships as a single
// copy-paste file. None of it is part of the public API.
// ===========================================================================

// ---------------------------------------------------------------------------
// Document — conversions between the live TipTap editor and the wire formats:
// the opaque snapshot (ProseMirror JSON) and the {text, chips} submit payload.
// ---------------------------------------------------------------------------

const snapshotFromEditor = (editor: Editor): ComposerSnapshot =>
  ({
    __pmDoc: editor.getJSON(),
    __brand: "ComposerSnapshot",
  }) as ComposerSnapshot;

const applySnapshotToEditor = (editor: Editor, snapshot: ComposerSnapshot): void => {
  editor.commands.setContent(snapshot.__pmDoc as never);
};

const serializeEditorContent = (editor: Editor): { text: string; chips: ChipData[] } => {
  const chipsByKey = new Map<string, ChipData>();
  const blocks: string[] = [];

  editor.state.doc.forEach((block) => {
    if (block.type.name !== "paragraph") return;
    let inline = "";
    block.forEach((child) => {
      if (child.isText) {
        inline += child.text ?? "";
        return;
      }
      if (child.type.name !== "mentionChip") return;
      const attrs = child.attrs as {
        prefix?: string;
        value?: string;
        label?: string;
        icon?: ChipIconKey | null;
        variant?: ChipVariant | null;
      };
      const prefix = attrs.prefix ?? "";
      const value = attrs.value ?? "";
      const label = attrs.label ?? "";
      inline += encodeChipMarkdown(prefix, value, label);
      const key = `${prefix}:${value}`;
      if (!chipsByKey.has(key)) {
        chipsByKey.set(key, {
          prefix,
          value,
          label,
          ...(attrs.icon ? { icon: attrs.icon } : {}),
          ...(attrs.variant ? { variant: attrs.variant } : {}),
        });
      }
    });
    blocks.push(inline);
  });

  return { text: blocks.join("\n"), chips: [...chipsByKey.values()] };
};

// ---------------------------------------------------------------------------
// Editor controller — a single registered editor instance (one Composer per
// page) behind a null-safe port, so callers can drive the editor from anywhere
// inside or outside the tree.
// ---------------------------------------------------------------------------

let activeEditor: Editor | null = null;

// Registered by ComposerTextarea when the editor mounts; returns the
// unregister cleanup (called on unmount).
const registerComposerController = (instance: Editor) => {
  activeEditor = instance;
  return () => {
    if (activeEditor === instance) activeEditor = null;
  };
};

// The editor port: the single ComposerEditorHandle implementation plus the
// read/serialize operations internal callers need.
type ComposerEditorPort = ComposerEditorHandle & {
  getText: () => string;
  setText: (text: string) => void;
  serialize: () => { text: string; chips: ChipData[] };
  ensureFocus: () => void;
};

const composerController: ComposerEditorPort = {
  focus: () => activeEditor?.commands.focus(),
  blur: () => activeEditor?.commands.blur(),
  clear: () => activeEditor?.commands.setContent(""),
  insertText: (text) => activeEditor?.commands.insertContent(text),
  insertChip: (chip) => activeEditor?.commands.insertContent({ type: "mentionChip", attrs: chip }),
  getText: () => activeEditor?.getText() ?? "",
  setText: (text) => activeEditor?.commands.setContent(text),
  serialize: () => (activeEditor ? serializeEditorContent(activeEditor) : { text: "", chips: [] }),
  ensureFocus: () => {
    if (activeEditor && !activeEditor.isFocused) activeEditor.commands.focus();
  },
};

// ---------------------------------------------------------------------------
// Command list — prefix trigger detection
// ---------------------------------------------------------------------------

type RegisteredPrefix = {
  prefix: string;
  triggerRule: TriggerRule;
};

type CommandListPluginState = {
  isOpen: boolean;
  trigger: string | null;
  query: string;
  triggerStartPosition: number;
};

const CLOSED_COMMAND_STATE: CommandListPluginState = {
  isOpen: false,
  trigger: null,
  query: "",
  triggerStartPosition: 0,
};

const escapeRegex = (input: string) => input.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const detectActivePrefix = (args: {
  registered: RegisteredPrefix[];
  blockStart: number;
  cursorPosition: number;
  textBeforeCursor: string;
  fullDocText: string;
}): CommandListPluginState => {
  const { registered, blockStart, cursorPosition, textBeforeCursor, fullDocText } = args;

  for (const entry of registered) {
    if (entry.triggerRule === "doc-start") {
      if (fullDocText.startsWith(entry.prefix)) {
        return {
          isOpen: true,
          trigger: entry.prefix,
          query: fullDocText.slice(entry.prefix.length),
          triggerStartPosition: blockStart,
        };
      }
      continue;
    }

    const escaped = escapeRegex(entry.prefix);
    const pattern = new RegExp(`(^|[\\s])${escaped}([^\\s]*)$`);
    const match = textBeforeCursor.match(pattern);
    if (match) {
      const query = match[2];
      const triggerStartPosition = cursorPosition - query.length - entry.prefix.length;
      return {
        isOpen: true,
        trigger: entry.prefix,
        query,
        triggerStartPosition,
      };
    }
  }

  return CLOSED_COMMAND_STATE;
};

const computeNextHighlight = (
  rows: Array<{ value: string }>,
  current: string | null,
  direction: 1 | -1,
): string | null => {
  if (rows.length === 0) return null;
  const currentIndex = current === null ? -1 : rows.findIndex((row) => row.value === current);
  const nextIndex =
    currentIndex === -1 ? 0 : (currentIndex + direction + rows.length) % rows.length;
  return rows[nextIndex].value;
};

// ---------------------------------------------------------------------------
// Command list — fuzzy filtering. A prefix match wins outright (2); otherwise
// every matched character scores, with bonuses for adjacency and word-boundary
// hits, normalized by query length. Returns 0 when the query can't be matched.
// ---------------------------------------------------------------------------

const fuzzyScore = (query: string, target: string): number => {
  if (!query) return 1;
  const lowerQuery = query.toLowerCase();
  const lowerTarget = target.toLowerCase();

  if (lowerTarget.startsWith(lowerQuery)) return 2;

  let queryIndex = 0;
  let score = 0;
  let previousMatchIndex = -1;

  for (
    let targetIndex = 0;
    targetIndex < lowerTarget.length && queryIndex < lowerQuery.length;
    targetIndex++
  ) {
    if (lowerTarget[targetIndex] === lowerQuery[queryIndex]) {
      score += 1;
      if (previousMatchIndex === targetIndex - 1) score += 2;
      if (targetIndex === 0 || lowerTarget[targetIndex - 1] === " ") score += 1;
      previousMatchIndex = targetIndex;
      queryIndex++;
    }
  }

  return queryIndex === lowerQuery.length ? score / lowerQuery.length : 0;
};

const filterArrayItems = (items: CommandItemData[], query: string): CommandItemData[] => {
  if (!query) return items;
  return items
    .map((item) => {
      const target = `${item.label ?? item.value ?? ""} ${item.keywords ?? ""}`.trim();
      return { item, score: fuzzyScore(query, target) };
    })
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score)
    .map(({ item }) => item);
};

// ---------------------------------------------------------------------------
// Command list — store bridged to React via useSyncExternalStore
// ---------------------------------------------------------------------------

type CommandListSnapshot = {
  isOpen: boolean;
  trigger: string | null;
  query: string;
};

type CommandListStore = {
  subscribe: (listener: () => void) => () => void;
  getSnapshot: () => CommandListSnapshot;
  setSnapshot: (next: CommandListSnapshot) => void;
  // Imperative refs co-located with the store; not reactive.
  selectRef: RefObject<(() => void) | null>;
  navigateRef: RefObject<((direction: number) => void) | null>;
};

const createCommandListStore = (): CommandListStore => {
  let snapshot: CommandListSnapshot = {
    isOpen: false,
    trigger: null,
    query: "",
  };
  const listeners = new Set<() => void>();
  return {
    subscribe: (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    getSnapshot: () => snapshot,
    setSnapshot: (next) => {
      if (
        snapshot.isOpen === next.isOpen &&
        snapshot.trigger === next.trigger &&
        snapshot.query === next.query
      ) {
        return;
      }
      snapshot = next;
      for (const listener of listeners) listener();
    },
    selectRef: { current: null },
    navigateRef: { current: null },
  };
};

// ---------------------------------------------------------------------------
// Command list — ProseMirror plugin: prefix detection + active-trigger badge
// ---------------------------------------------------------------------------

const commandListPluginKey = new PluginKey<CommandListPluginState>("commandList");

const BADGE_CLASSES =
  "inline-flex items-center h-6 rounded-sm bg-primary-hover border border-transparent px-0.75 leading-[normal]";
const PLACEHOLDER_CLASSES =
  "after:content-['Type_to_filter'] after:text-ink-tertiary after:whitespace-nowrap after:pointer-events-none";

const commandFilterDecorations = (
  state: Parameters<NonNullable<Plugin["props"]["decorations"]>>[0],
) => {
  const pluginState = commandListPluginKey.getState(state);
  if (!pluginState?.isOpen) return DecorationSet.empty;
  const triggerStart = pluginState.triggerStartPosition;
  const cursorPosition = state.selection.$from.pos;
  const classes = pluginState.query ? BADGE_CLASSES : `${BADGE_CLASSES} ${PLACEHOLDER_CLASSES}`;
  const inline = Decoration.inline(triggerStart, cursorPosition, {
    class: classes,
  });
  return DecorationSet.create(state.doc, [inline]);
};

const createCommandListPlugin = (getRegisteredPrefixes: () => RegisteredPrefix[]) =>
  new Plugin<CommandListPluginState>({
    key: commandListPluginKey,
    state: {
      init: () => CLOSED_COMMAND_STATE,
      apply(transaction, previousState, _oldEditorState, newEditorState) {
        const meta = transaction.getMeta(commandListPluginKey);
        if (meta?.close) return CLOSED_COMMAND_STATE;
        if (!transaction.docChanged && !transaction.selectionSet) {
          return previousState;
        }

        const registered = getRegisteredPrefixes();
        if (registered.length === 0) return CLOSED_COMMAND_STATE;

        const { selection } = newEditorState;
        const cursorPosition = selection.$from.pos;
        const blockStart = selection.$from.start();
        const textBeforeCursor = newEditorState.doc.textBetween(blockStart, cursorPosition, "\n");
        const fullDocText = newEditorState.doc.textContent;

        return detectActivePrefix({
          registered,
          blockStart,
          cursorPosition,
          textBeforeCursor,
          fullDocText,
        });
      },
    },
    props: { decorations: commandFilterDecorations },
  });

// ---------------------------------------------------------------------------
// Keyboard interpreters — translate a raw key event (reduced to plain data)
// plus surrounding state into a high-level action. No React or DOM access:
// the component layer decides what a key means here and keeps the how
// (preventDefault, focus, dispatch) at the call site.
// ---------------------------------------------------------------------------

type EditorKeyAction =
  | { type: "command-select" }
  | { type: "command-close" }
  | { type: "command-navigate"; direction: 1 | -1 }
  | { type: "ask-user-arrow"; direction: 1 | -1 }
  | { type: "remove-last-attachment" }
  | { type: "submit-form" }
  | { type: "soft-break" };

type EditorKeyContext = {
  isCommandListOpen: boolean;
  hasActiveAskUser: boolean;
  isEditorEmpty: boolean;
  hasAttachments: boolean;
};

const interpretEditorKey = (
  event: { key: string; shiftKey: boolean },
  context: EditorKeyContext,
): EditorKeyAction | null => {
  const { key, shiftKey } = event;
  const { isCommandListOpen, hasActiveAskUser } = context;

  switch (true) {
    case isCommandListOpen && key === "Tab":
      return { type: "command-select" };
    case isCommandListOpen && key === "Escape":
      return { type: "command-close" };
    case isCommandListOpen && key === "ArrowUp":
      return { type: "command-navigate", direction: -1 };
    case isCommandListOpen && key === "ArrowDown":
      return { type: "command-navigate", direction: 1 };
    case isCommandListOpen && key === "Enter" && !shiftKey:
      return { type: "command-select" };

    case hasActiveAskUser && key === "ArrowUp":
      return { type: "ask-user-arrow", direction: -1 };
    case hasActiveAskUser && key === "ArrowDown":
      return { type: "ask-user-arrow", direction: 1 };

    case key === "Backspace" && context.isEditorEmpty && context.hasAttachments:
      return { type: "remove-last-attachment" };

    case key === "Enter" && !shiftKey:
      return { type: "submit-form" };
    case key === "Enter" && shiftKey:
      return { type: "soft-break" };

    default:
      return null;
  }
};

type AskUserKeyAction =
  | { type: "dismiss-step" }
  | { type: "navigate-options"; direction: 1 | -1 }
  | { type: "select-option" }
  | { type: "go-back" }
  | { type: "go-next" }
  | { type: "insert-character"; character: string };

type AskUserKeyEvent = {
  key: string;
  ctrlKey: boolean;
  metaKey: boolean;
  altKey: boolean;
  defaultPrevented: boolean;
};

const interpretAskUserKey = (
  event: AskUserKeyEvent,
  context: { hasHighlight: boolean },
): AskUserKeyAction | null => {
  const { key } = event;

  switch (true) {
    case event.defaultPrevented:
      return null;
    case key === "Escape":
      return { type: "dismiss-step" };
    case !context.hasHighlight:
      return null;

    case key === "ArrowUp":
      return { type: "navigate-options", direction: -1 };
    case key === "ArrowDown":
      return { type: "navigate-options", direction: 1 };
    case key === "Enter":
      return { type: "select-option" };
    case key === "ArrowLeft":
      return { type: "go-back" };
    case key === "ArrowRight":
      return { type: "go-next" };

    default: {
      const isPrintable = key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey;
      return isPrintable ? { type: "insert-character", character: key } : null;
    }
  }
};

// ---------------------------------------------------------------------------
// Ask-user — pure state machine for the questionnaire flow. State is a current
// step plus a map of per-step answers; every transition is an immutable map
// operation, so the hook only owns the useState cell and the focus side effects.
// ---------------------------------------------------------------------------

type AnswerEntry = {
  selected: Set<string>;
  freeText: string;
};

type AskUserState = {
  step: number;
  answers: Map<number, AnswerEntry>;
};

const INITIAL_ASK_USER_STATE: AskUserState = {
  step: 0,
  answers: new Map(),
};

const emptyEntry = (): AnswerEntry => ({
  selected: new Set<string>(),
  freeText: "",
});

const cloneAnswers = (source: Map<number, AnswerEntry>) => new Map(source);

// Record `text` as the step's free-text answer. Single-select treats text and
// a chosen option as mutually exclusive, so any selection is dropped;
// multi-select keeps existing selections alongside the text. Empty text is a
// no-op (returns an untouched clone).
const writeFreeText = (
  answers: Map<number, AnswerEntry>,
  step: number,
  text: string,
  multiSelect: boolean,
) => {
  const next = cloneAnswers(answers);
  if (text.length === 0) return next;
  const previous = next.get(step) ?? emptyEntry();
  next.set(step, {
    selected: multiSelect ? previous.selected : new Set(),
    freeText: text,
  });
  return next;
};

// Remove the step's entry entirely (skip / dismiss).
const skipStep = (answers: Map<number, AnswerEntry>, step: number): Map<number, AnswerEntry> => {
  const next = cloneAnswers(answers);
  next.delete(step);
  return next;
};

// Project the collected answers onto the public ComposerAnswerEntry union, one
// entry per question in order. The chosen branch encodes the invariant:
// single-select carries `option` *or* `text`; multi-select carries both;
// an unanswered question is bare `{ question }`.
const compileAnswers = (state: AskUserState, questions: AskUserQuestion[]) =>
  questions.map(({ question, multiSelect }, index) => {
    const entry = state.answers.get(index);
    if (!entry) return { question };

    const selected = [...entry.selected];
    const text = entry.freeText.trim();

    if (multiSelect) {
      if (selected.length === 0 && text === "") return { question };
      return { question, options: selected, text };
    }

    if (selected.length > 0) return { question, option: selected[0] };
    if (text !== "") return { question, text };
    return { question };
  });

const isLastStep = (state: AskUserState, questions: AskUserQuestion[]) =>
  state.step >= questions.length - 1;

// ---------------------------------------------------------------------------
// Attachments — pure store reducer that validates and accumulates files. The
// hook owns the useState; this owns the rules.
// ---------------------------------------------------------------------------

type AttachmentStoreState = {
  items: AttachmentItem[];
  error: string | null;
};

type AttachmentStoreAction =
  | { type: "add"; files: File[] | FileList }
  | { type: "remove"; id: string }
  | { type: "reset" };

type AttachmentStoreConfig = {
  accept: string;
  maxFiles: number;
  maxFileSize: number;
};

const INITIAL_ATTACHMENT_STATE: AttachmentStoreState = {
  items: [],
  error: null,
};

const attachmentReducer = (
  state: AttachmentStoreState,
  action: AttachmentStoreAction,
  config: AttachmentStoreConfig,
): AttachmentStoreState => {
  switch (action.type) {
    case "add": {
      const incoming = [...action.files];
      if (!incoming.length) return state;

      const accepted = incoming.filter((file) => matchesAccept(file, config.accept));
      if (!accepted.length) {
        return { ...state, error: "No files match the accepted types." };
      }

      const sized = accepted.filter((file) => file.size <= config.maxFileSize);
      if (!sized.length) {
        return { ...state, error: "All files exceed the maximum size." };
      }

      const capacity = Math.max(0, config.maxFiles - state.items.length);
      const capped = sized.slice(0, capacity);

      const overCapacityError =
        sized.length > capacity ? "Too many files. Some were not added." : null;

      if (!capped.length) {
        return { ...state, error: overCapacityError ?? state.error };
      }

      return {
        items: [...state.items, ...capped.map(toAttachmentItem)],
        error: overCapacityError,
      };
    }
    case "remove": {
      const found = state.items.find((item) => item.id === action.id);
      if (found) revokeAttachmentUrl(found);
      return {
        items: state.items.filter((item) => item.id !== action.id),
        error: null,
      };
    }
    case "reset": {
      revokeAllAttachmentUrls(state.items);
      return INITIAL_ATTACHMENT_STATE;
    }
  }
};

// ---------------------------------------------------------------------------
// Attachments — drag-and-drop handlers. A depth counter tracks enter/leave so
// nested elements don't flicker the dragging state.
// ---------------------------------------------------------------------------

type DragHandlerCallbacks = {
  isInScope: (event: DragEvent) => boolean;
  onFiles: (files: FileList) => void;
  setDragging: (active: boolean) => void;
};

const createDragHandlers = (callbacks: DragHandlerCallbacks) => {
  const counter = { current: 0 };
  const carriesFiles = (event: DragEvent) => event.dataTransfer?.types?.includes("Files") ?? false;

  return {
    onDragOver: (event: Event) => {
      const dragEvent = event as DragEvent;
      if (!callbacks.isInScope(dragEvent)) return;
      if (carriesFiles(dragEvent)) dragEvent.preventDefault();
    },
    onDragEnter: (event: Event) => {
      const dragEvent = event as DragEvent;
      if (!callbacks.isInScope(dragEvent)) return;
      if (carriesFiles(dragEvent)) {
        counter.current++;
        callbacks.setDragging(true);
      }
    },
    onDragLeave: (event: Event) => {
      const dragEvent = event as DragEvent;
      if (!callbacks.isInScope(dragEvent)) return;
      counter.current--;
      if (counter.current === 0) callbacks.setDragging(false);
    },
    onDrop: (event: Event) => {
      const dragEvent = event as DragEvent;
      if (!callbacks.isInScope(dragEvent)) return;
      if (carriesFiles(dragEvent)) dragEvent.preventDefault();
      counter.current = 0;
      callbacks.setDragging(false);
      const files = dragEvent.dataTransfer?.files;
      if (files && files.length > 0) callbacks.onFiles(files);
    },
  };
};

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------

type ComposerEditorState = {
  hasContent: boolean;
  setHasContent: (value: boolean) => void;
  isSubmitting: boolean;
};

type ComposerAttachmentsState = {
  items: AttachmentItem[];
  add: (files: File[] | FileList) => void;
  remove: (id: string) => void;
  openFileDialog: () => void;
  error: string | null;
  isDragging: boolean;
  fileInputRef: RefObject<HTMLInputElement | null>;
  globalDropRef: RefObject<boolean>;
};

type ComposerAskUserState = {
  questions: AskUserQuestion[] | null;
  step: number;
  answers: Map<number, AnswerEntry>;
  toggleOption: (step: number, label: string, multiSelect: boolean) => void;
  continueStep: (freeText?: string) => void;
  dismissStep: () => void;
  isLastStep: boolean;
  isSingle: boolean;
  clearSelections: (step: number) => void;
  goBack: () => void;
  goNext: () => void;
  optionsRef: RefObject<AskUserOptionsHandle | null>;
};

type ComposerContextValue = {
  editor: ComposerEditorState;
  attachments: ComposerAttachmentsState;
  askUser: ComposerAskUserState;
};

const ComposerContext = createContext<ComposerContextValue | null>(null);

export const useComposer = (): ComposerContextValue => {
  const context = useContext(ComposerContext);
  if (!context) {
    throw new Error("useComposer must be called inside a <Composer> subtree.");
  }
  return context;
};

type ComposerInternalsValue = {
  editorRef: RefObject<Editor | null>;
  attachmentConfigRef: RefObject<AttachmentStoreConfig>;
  commands: ComposerCommandsMap;
  commandListStore: CommandListStore;
  getRegisteredPrefixes: () => RegisteredPrefix[];
  reportEditorUpdate: (editor: Editor) => void;
};

const ComposerInternalsContext = createContext<ComposerInternalsValue | null>(null);

const useComposerInternals = (): ComposerInternalsValue => {
  const context = useContext(ComposerInternalsContext);
  if (!context) {
    throw new Error("useComposerInternals must be called inside a <Composer> subtree.");
  }
  return context;
};

const useCommandListSnapshot = <T,>(selector: (snapshot: CommandListSnapshot) => T): T => {
  const { commandListStore } = useComposerInternals();
  const getValue = useCallback(
    () => selector(commandListStore.getSnapshot()),
    [commandListStore, selector],
  );
  return useSyncExternalStore(commandListStore.subscribe, getValue, getValue);
};

// ---------------------------------------------------------------------------
// TipTap mention-chip extension
// ---------------------------------------------------------------------------

const MentionChipNodeView = ({ node }: { node: { attrs: Record<string, unknown> } }) => {
  const label = node.attrs.label as string;
  const icon = node.attrs.icon as ChipIconKey | null;
  const variant = node.attrs.variant as ChipVariant | null;

  return (
    <NodeViewWrapper as="span" data-mention-chip>
      <Chip variant={variant ?? undefined}>
        {icon && <Chip.Icon>{CHIP_ICONS[icon]}</Chip.Icon>}
        <Chip.Label>{label}</Chip.Label>
      </Chip>
    </NodeViewWrapper>
  );
};

const createMentionChipExtension = (getRegisteredPrefixes: () => RegisteredPrefix[]) =>
  TiptapNode.create({
    name: "mentionChip",
    group: "inline",
    inline: true,
    atom: true,

    addAttributes() {
      return {
        prefix: { default: "" },
        label: { default: "" },
        value: { default: "" },
        icon: { default: null },
        variant: { default: null },
      };
    },

    parseHTML() {
      return [{ tag: "span[data-mention-chip]" }];
    },

    renderHTML({ HTMLAttributes }) {
      return ["span", mergeAttributes({ "data-mention-chip": "" }, HTMLAttributes), 0];
    },

    addNodeView() {
      return ReactNodeViewRenderer(MentionChipNodeView);
    },

    addProseMirrorPlugins() {
      return [createCommandListPlugin(getRegisteredPrefixes)];
    },
  });

// ---------------------------------------------------------------------------
// Hooks
// ---------------------------------------------------------------------------

// SSR-safe layout effect — same shape as cmdk's. useLayoutEffect runs before
// paint; useEffect is a no-op fallback when window is undefined (SSR pass).
const useIsomorphicLayoutEffect = typeof window === "undefined" ? useEffect : useLayoutEffect;

// Mirror a prop into a ref so closures always see the latest value without
// having to add the prop to dep arrays. Layout effect ensures `.current` is
// updated before any sibling layout effect or sync user event observes it.
const useAsRef = <T,>(value: T) => {
  const ref = useRef(value);
  useIsomorphicLayoutEffect(() => {
    ref.current = value;
  });
  return ref;
};

// Like useRef, but the initializer runs at most once. Used for stable stores.
const useLazyRef = <T,>(initializer: () => T) => {
  const ref = useRef<T | undefined>(undefined);
  if (ref.current === undefined) ref.current = initializer();
  return ref as { current: T };
};

const useAttachmentStore = (configRef: RefObject<AttachmentStoreConfig>) => {
  const [state, setState] = useState<AttachmentStoreState>(INITIAL_ATTACHMENT_STATE);

  const add = useCallback(
    (files: File[] | FileList) => {
      setState((current) => attachmentReducer(current, { type: "add", files }, configRef.current));
    },
    [configRef],
  );

  const remove = useCallback(
    (id: string) => {
      setState((current) => attachmentReducer(current, { type: "remove", id }, configRef.current));
    },
    [configRef],
  );

  const reset = useCallback(() => {
    setState((current) => attachmentReducer(current, { type: "reset" }, configRef.current));
  }, [configRef]);

  return useMemo(
    () => ({ items: state.items, error: state.error, add, remove, reset }),
    [state.items, state.error, add, remove, reset],
  );
};

const useCommandRegistry = (commands: ComposerCommandsMap) => {
  const registryRef = useAsRef(commands);

  const getRegisteredPrefixes = useCallback((): RegisteredPrefix[] => {
    const result: RegisteredPrefix[] = [];
    for (const [prefix, entry] of Object.entries(registryRef.current)) {
      result.push({ prefix, triggerRule: entry.trigger });
    }
    return result;
  }, []);

  return { getRegisteredPrefixes };
};

const useDragDropFiles = ({
  rootRef,
  globalDropRef,
  onFiles,
}: {
  rootRef: RefObject<HTMLElement | null>;
  globalDropRef: RefObject<boolean>;
  onFiles: (files: FileList) => void;
}): { isDragging: boolean } => {
  const [isDragging, setIsDragging] = useState(false);

  const onFilesRef = useAsRef(onFiles);

  useEffect(() => {
    const isInScope = (event: DragEvent) =>
      globalDropRef.current || (rootRef.current?.contains(event.target as Node) ?? false);

    const handlers = createDragHandlers({
      isInScope,
      onFiles: (files) => onFilesRef.current(files),
      setDragging: setIsDragging,
    });

    document.addEventListener("dragover", handlers.onDragOver);
    document.addEventListener("dragenter", handlers.onDragEnter);
    document.addEventListener("dragleave", handlers.onDragLeave);
    document.addEventListener("drop", handlers.onDrop);
    return () => {
      document.removeEventListener("dragover", handlers.onDragOver);
      document.removeEventListener("dragenter", handlers.onDragEnter);
      document.removeEventListener("dragleave", handlers.onDragLeave);
      document.removeEventListener("drop", handlers.onDrop);
    };
  }, [rootRef, globalDropRef]);

  return { isDragging };
};

type AnswerInput = Pick<ComposerEditorPort, "getText" | "setText" | "clear" | "focus" | "blur">;

const useAskUser = ({
  answerInput,
  optionsRef,
  setEditorHasContent,
  submitAnswers,
  questions,
}: {
  answerInput: AnswerInput;
  optionsRef: RefObject<AskUserOptionsHandle | null>;
  setEditorHasContent: (value: boolean) => void;
  submitAnswers: (answers: ComposerAnswerEntry[]) => void;
  questions: AskUserQuestion[] | undefined;
}) => {
  const [reducerState, setReducerState] = useState<AskUserState>(INITIAL_ASK_USER_STATE);

  const stateRef = useAsRef(reducerState);
  const questionsRef = useAsRef<AskUserQuestion[] | null>(questions ?? null);
  const submitAnswersRef = useAsRef(submitAnswers);

  // Reset reducer state and blur editor when the questions identity changes.
  const previousQuestionsRef = useRef(questions);
  if (previousQuestionsRef.current !== questions) {
    previousQuestionsRef.current = questions;
    setReducerState(INITIAL_ASK_USER_STATE);
    if (questions && questions.length > 0) answerInput.blur();
  }

  const toggleOption = useCallback(
    (step: number, label: string, multiSelect: boolean) => {
      setReducerState((current) => {
        const next = cloneAnswers(current.answers);
        const previous = next.get(step) ?? emptyEntry();
        const selected = new Set(previous.selected);
        if (multiSelect) {
          if (selected.has(label)) selected.delete(label);
          else selected.add(label);
        } else {
          selected.clear();
          selected.add(label);
        }
        next.set(step, {
          selected,
          freeText: multiSelect ? previous.freeText : "",
        });
        return { ...current, answers: next };
      });
      if (!multiSelect) {
        answerInput.clear();
        setEditorHasContent(false);
      }
    },
    [answerInput, setEditorHasContent],
  );

  const clearSelections = useCallback((step: number) => {
    setReducerState((current) => {
      const previous = current.answers.get(step);
      if (!previous || previous.selected.size === 0) return current;
      const next = cloneAnswers(current.answers);
      next.set(step, { selected: new Set(), freeText: previous.freeText });
      return { ...current, answers: next };
    });
  }, []);

  // Shared tail for continue/dismiss: commit the next answers, advance one
  // step, reset the editor, then either move to the next question or submit on
  // the last step. The two callers differ only in how they build `nextAnswers`.
  const advance = useCallback(
    (nextAnswers: Map<number, AnswerEntry>) => {
      const activeQuestions = questionsRef.current;
      if (!activeQuestions || activeQuestions.length === 0) return;

      const currentStep = stateRef.current.step;
      const advanced: AskUserState = {
        step: currentStep + 1,
        answers: nextAnswers,
      };
      setReducerState(advanced);

      answerInput.clear();
      setEditorHasContent(false);

      if (currentStep < activeQuestions.length - 1) {
        optionsRef.current?.resetHighlight();
        answerInput.blur();
      } else {
        submitAnswersRef.current(compileAnswers(advanced, activeQuestions));
        answerInput.focus();
      }
    },
    [answerInput, optionsRef, setEditorHasContent],
  );

  const continueStep = useCallback(
    (freeText?: string) => {
      const activeQuestions = questionsRef.current;
      if (!activeQuestions || activeQuestions.length === 0) return;

      const currentStep = stateRef.current.step;
      const multiSelect = !!activeQuestions[currentStep]?.multiSelect;
      advance(
        writeFreeText(stateRef.current.answers, currentStep, freeText?.trim() ?? "", multiSelect),
      );
    },
    [advance],
  );

  const dismissStep = useCallback(() => {
    advance(skipStep(stateRef.current.answers, stateRef.current.step));
  }, [advance]);

  const transitionStep = useCallback(
    (targetStep: number) => {
      const currentStep = stateRef.current.step;
      if (targetStep === currentStep) return;

      const currentText = answerInput.getText().trim();
      const next = cloneAnswers(stateRef.current.answers);
      if (currentText.length > 0) {
        const previous = next.get(currentStep) ?? emptyEntry();
        next.set(currentStep, { ...previous, freeText: currentText });
      }
      const navigated: AskUserState = { step: targetStep, answers: next };
      setReducerState(navigated);

      const targetEntry = navigated.answers.get(targetStep);
      const targetFreeText = targetEntry?.freeText ?? "";
      answerInput.setText(targetFreeText);
      setEditorHasContent(targetFreeText.length > 0);
      optionsRef.current?.resetHighlight();
      answerInput.blur();
    },
    [answerInput, optionsRef, setEditorHasContent],
  );

  const goBack = useCallback(() => {
    transitionStep(Math.max(0, stateRef.current.step - 1));
  }, [transitionStep]);

  const goNext = useCallback(() => {
    const activeQuestions = questionsRef.current;
    if (!activeQuestions) return;
    transitionStep(Math.min(activeQuestions.length - 1, stateRef.current.step + 1));
  }, [transitionStep]);

  const isLast = useMemo(
    () => (questions ? isLastStep(reducerState, questions) : false),
    [reducerState, questions],
  );
  const isSingle = useMemo(() => (questions ? questions.length === 1 : false), [questions]);

  const state: ComposerAskUserState = useMemo(
    () => ({
      questions: questions ?? null,
      step: reducerState.step,
      answers: reducerState.answers,
      toggleOption,
      continueStep,
      dismissStep,
      isLastStep: isLast,
      isSingle,
      clearSelections,
      goBack,
      goNext,
      optionsRef,
    }),
    [
      questions,
      reducerState.step,
      reducerState.answers,
      toggleOption,
      continueStep,
      dismissStep,
      isLast,
      isSingle,
      clearSelections,
      goBack,
      goNext,
      optionsRef,
    ],
  );

  return state;
};

const useComposerSnapshot = ({
  editorRef,
  defaultValue,
  value,
  onValueChange,
}: {
  editorRef: RefObject<Editor | null>;
  defaultValue?: ComposerSnapshot;
  value?: ComposerSnapshot;
  onValueChange?: (snapshot: ComposerSnapshot) => void;
}): { reportEditorUpdate: (editor: Editor) => void } => {
  const isControlled = value !== undefined;
  const lastAppliedRef = useRef<ComposerSnapshot | null>(null);
  const initializedRef = useRef(false);

  const onValueChangeRef = useAsRef(onValueChange);

  useEffect(() => {
    const editor = editorRef.current;
    if (!editor || initializedRef.current) return;
    if (defaultValue) {
      applySnapshotToEditor(editor, defaultValue);
      lastAppliedRef.current = defaultValue;
    }
    initializedRef.current = true;
  }, [editorRef, defaultValue]);

  useEffect(() => {
    if (!isControlled) return;
    const editor = editorRef.current;
    if (!editor || !value) return;
    if (lastAppliedRef.current === value) return;
    applySnapshotToEditor(editor, value);
    lastAppliedRef.current = value;
  }, [editorRef, isControlled, value]);

  const reportEditorUpdate = useCallback((editor: Editor) => {
    if (!onValueChangeRef.current) return;
    const snapshot = snapshotFromEditor(editor);
    lastAppliedRef.current = snapshot;
    onValueChangeRef.current(snapshot);
  }, []);

  return { reportEditorUpdate };
};

// ---------------------------------------------------------------------------
// Composer.Root
// ---------------------------------------------------------------------------

const EMPTY_COMMANDS: ComposerCommandsMap = {};

export type ComposerRootProps = Omit<ComponentProps<"form">, "onSubmit" | "ref"> & {
  onSubmit?: (data: ComposerSubmitData) => void | Promise<void>;
  isSubmitting?: boolean;
  commands?: ComposerCommandsMap;
  questions?: AskUserQuestion[];
  defaultValue?: ComposerSnapshot;
  value?: ComposerSnapshot;
  onValueChange?: (snapshot: ComposerSnapshot) => void;
};

const ComposerRoot = ({
  children,
  className,
  onSubmit,
  isSubmitting = false,
  commands = EMPTY_COMMANDS,
  questions,
  defaultValue,
  value,
  onValueChange,
  ...formProps
}: ComposerRootProps) => {
  const editorRef = useRef<Editor | null>(null);
  const formRef = useRef<HTMLFormElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const globalDropRef = useRef(false);
  const askUserOptionsRef = useRef<AskUserOptionsHandle | null>(null);
  const attachmentConfigRef = useRef<AttachmentStoreConfig>({
    accept: DEFAULT_ATTACHMENT_ACCEPT,
    maxFiles: DEFAULT_ATTACHMENT_MAX_FILES,
    maxFileSize: DEFAULT_ATTACHMENT_MAX_FILE_SIZE,
  });
  const commandListStore = useLazyRef(() => createCommandListStore()).current;

  const [editorHasContent, setEditorHasContent] = useState(false);

  const attachments = useAttachmentStore(attachmentConfigRef);

  const onSubmitRef = useAsRef(onSubmit);

  const submitAnswers = useCallback((answers: ComposerAnswerEntry[]) => {
    onSubmitRef.current?.({ kind: "answers", answers });
  }, []);

  const askUser = useAskUser({
    answerInput: composerController,
    optionsRef: askUserOptionsRef,
    setEditorHasContent,
    submitAnswers,
    questions,
  });

  const { getRegisteredPrefixes } = useCommandRegistry(commands);

  const { isDragging } = useDragDropFiles({
    rootRef: formRef,
    globalDropRef,
    onFiles: attachments.add,
  });

  const { reportEditorUpdate } = useComposerSnapshot({
    editorRef,
    defaultValue,
    value,
    onValueChange,
  });

  const askUserRef = useAsRef(askUser);

  useEffect(() => {
    if ((askUser.questions?.length ?? 0) === 0) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      const optionsHandle = askUserOptionsRef.current;
      const action = interpretAskUserKey(
        {
          key: event.key,
          ctrlKey: event.ctrlKey,
          metaKey: event.metaKey,
          altKey: event.altKey,
          defaultPrevented: event.defaultPrevented,
        },
        { hasHighlight: optionsHandle?.highlightedValue != null },
      );
      if (!action) return;
      event.preventDefault();
      const current = askUserRef.current;
      switch (action.type) {
        case "dismiss-step":
          current.dismissStep();
          return;
        case "navigate-options": {
          const newValue = optionsHandle?.navigate(action.direction);
          if (newValue === null) composerController.focus();
          return;
        }
        case "select-option": {
          const item = optionsHandle?.select();
          if (!item) return;
          const currentQuestion = current.questions?.[current.step];
          if (currentQuestion?.multiSelect) {
            current.toggleOption(current.step, item.value, true);
          } else {
            current.toggleOption(current.step, item.value, false);
            current.continueStep();
          }
          return;
        }
        case "go-back":
          current.goBack();
          return;
        case "go-next":
          current.goNext();
          return;
        case "insert-character": {
          optionsHandle?.clearHighlight();
          composerController.focus();
          composerController.insertText(action.character);
          return;
        }
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [askUser.questions]);

  const handleFormSubmit = async (event: React.SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (askUser.questions?.length) {
      const text = composerController.getText().trim();
      composerController.clear();
      setEditorHasContent(false);
      askUser.continueStep(text);
      return;
    }

    if (isSubmitting) return;

    const serialized = composerController.serialize();
    const trimmedText = serialized.text.trim();
    if (!trimmedText && !attachments.items.length) return;

    const submitText = trimmedText || "Sent with attachments";
    const fileItems: AttachmentItem[] = attachments.items;
    const fileParts = fileItems.length > 0 ? await prepareAttachmentsForSend(fileItems) : [];

    attachments.reset();
    composerController.clear();
    setEditorHasContent(false);

    await onSubmitRef.current?.({
      kind: "message",
      text: submitText,
      files: fileParts,
      chips: serialized.chips,
    });
  };

  const editorState = useMemo(
    () => ({
      hasContent: editorHasContent,
      setHasContent: setEditorHasContent,
      isSubmitting,
    }),
    [editorHasContent, isSubmitting],
  );

  const attachmentsState = useMemo(
    () => ({
      items: attachments.items,
      add: attachments.add,
      remove: attachments.remove,
      openFileDialog: () => fileInputRef.current?.click(),
      error: attachments.error,
      isDragging,
      fileInputRef,
      globalDropRef,
    }),
    [attachments.items, attachments.add, attachments.remove, attachments.error, isDragging],
  );

  const contextValue = useMemo<ComposerContextValue>(
    () => ({
      editor: editorState,
      attachments: attachmentsState,
      askUser,
    }),
    [editorState, attachmentsState, askUser],
  );

  const internalsValue = useMemo<ComposerInternalsValue>(
    () => ({
      editorRef,
      attachmentConfigRef,
      commands,
      commandListStore,
      getRegisteredPrefixes,
      reportEditorUpdate,
    }),
    [commands, commandListStore, getRegisteredPrefixes, reportEditorUpdate],
  );

  return (
    <ComposerContext.Provider value={contextValue}>
      <ComposerInternalsContext.Provider value={internalsValue}>
        <form
          onSubmit={handleFormSubmit}
          ref={formRef}
          className={cn("relative w-full flex flex-col", className)}
          {...formProps}
        >
          {children}
        </form>
      </ComposerInternalsContext.Provider>
    </ComposerContext.Provider>
  );
};

// ---------------------------------------------------------------------------
// Composer.Container
// ---------------------------------------------------------------------------

type ComposerContainerProps = ComponentProps<"div">;

const ComposerContainer = ({ className, children, ...props }: ComposerContainerProps) => {
  const handleMouseDown = (event: React.MouseEvent<HTMLDivElement>) => {
    const target = event.target as HTMLElement;
    if (
      target.tagName === "BUTTON" ||
      target.tagName === "A" ||
      target.tagName === "INPUT" ||
      target.closest("button, a, input")
    ) {
      return;
    }

    event.preventDefault();
    composerController.ensureFocus();
  };

  return (
    <div
      role="button"
      tabIndex={0}
      data-slot="composer-container"
      onMouseDown={handleMouseDown}
      className={cn(
        "border border-primary-border bg-primary rounded-4xl shadow-xs [corner-shape:squircle] cursor-text transition-colors",
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
};

// ---------------------------------------------------------------------------
// Composer.Attachments / Composer.AttachmentTrigger
// ---------------------------------------------------------------------------

type ComposerAttachmentsProps = {
  className?: string;
  accept?: string;
  maxFiles?: number;
  maxFileSize?: number;
  multiple?: boolean;
  globalDrop?: boolean;
};

const ComposerAttachments = ({
  className,
  accept = DEFAULT_ATTACHMENT_ACCEPT,
  maxFiles = DEFAULT_ATTACHMENT_MAX_FILES,
  maxFileSize = DEFAULT_ATTACHMENT_MAX_FILE_SIZE,
  multiple = true,
  globalDrop = false,
}: ComposerAttachmentsProps) => {
  const { attachments } = useComposer();
  const { attachmentConfigRef } = useComposerInternals();

  attachmentConfigRef.current = { accept, maxFiles, maxFileSize };
  attachments.globalDropRef.current = globalDrop;

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    if (event.currentTarget.files) {
      attachments.add(event.currentTarget.files);
    }
    event.currentTarget.value = "";
  };

  return (
    <>
      <input
        accept={accept}
        className="hidden"
        multiple={multiple}
        onChange={handleFileChange}
        ref={attachments.fileInputRef}
        type="file"
      />

      <AnimatePresence initial={false}>
        {(attachments.isDragging || attachments.items.length > 0) && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className="overflow-hidden"
          >
            <div className="relative">
              {attachments.items.length > 0 ? (
                <div className={cn("flex flex-wrap gap-2 p-2", className)}>
                  <AnimatePresence initial={false}>
                    {attachments.items.map((attachment) => (
                      <Attachments.Item key={attachment.id} item={attachment}>
                        <Attachments.Remove onRemove={() => attachments.remove(attachment.id)} />
                      </Attachments.Item>
                    ))}
                  </AnimatePresence>
                </div>
              ) : (
                <div className="h-14" />
              )}
              <Attachments.Dropzone visible={attachments.isDragging} variant="inline" />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      <Attachments.Error />
    </>
  );
};

type ComposerAttachmentTriggerProps = ComponentProps<typeof IconButton>;

const ComposerAttachmentTrigger = (props: ComposerAttachmentTriggerProps) => {
  const { attachments } = useComposer();

  return (
    <Attachments.Trigger
      data-slot="composer-attachment-trigger"
      onClick={() => attachments.openFileDialog()}
      {...props}
    />
  );
};

// ---------------------------------------------------------------------------
// Composer.Textarea / Composer.Placeholder
// ---------------------------------------------------------------------------

type ComposerTextareaProps = {
  value?: string;
  onValueChange?: (text: string) => void;
  className?: string;
  disabled?: boolean;
  autoFocus?: boolean;
  children?: ReactNode;
};

const ComposerTextarea = ({
  value,
  onValueChange,
  className,
  disabled = false,
  autoFocus = false,
  children,
}: ComposerTextareaProps) => {
  const { editor, attachments, askUser } = useComposer();
  const { editorRef, commandListStore, getRegisteredPrefixes, reportEditorUpdate } =
    useComposerInternals();

  const isControlled = value !== undefined;

  const onValueChangeRef = useAsRef(onValueChange);
  const attachmentsRef = useAsRef(attachments);
  const askUserRef = useAsRef(askUser);

  // Single-select questions clear their selection once the user starts typing
  // a free-text answer. Stable across renders — it only reads the live askUser
  // value through its ref.
  const clearSelectionsIfSingle = useCallback(() => {
    const current = askUserRef.current;
    if (!current.questions) return;
    const currentQuestion = current.questions[current.step];
    if (!currentQuestion?.multiSelect) {
      current.clearSelections(current.step);
    }
  }, []);

  const mentionExtension = useMemo(
    () => createMentionChipExtension(getRegisteredPrefixes),
    [getRegisteredPrefixes],
  );

  const tiptapEditor = useEditor({
    immediatelyRender: false,
    extensions: [Document, Paragraph, Text, mentionExtension],
    content: isControlled ? value : "",
    editorProps: {
      attributes: {
        class: cn("max-w-none focus:outline-none w-full font-[450] leading-[1.7]"),
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
            attachmentsRef.current.add(files);
            return true;
          }
        }

        const pastedText = event.clipboardData?.getData("text/plain");
        if (!pastedText || !pastedText.includes("(chip:")) return false;

        const segments = parseChipSegments(pastedText);
        if (!segments.some((segment) => segment.type === "chip")) return false;

        const editor = editorRef.current;
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
            hasActiveAskUser: (askUserRef.current.questions?.length ?? 0) > 0,
            isEditorEmpty: view.state.doc.textContent === "",
            hasAttachments: attachmentsRef.current.items.length > 0,
          },
        );

        if (!action) return false;

        switch (action.type) {
          case "command-select": {
            event.preventDefault();
            commandListStore.selectRef.current?.();
            return true;
          }
          case "command-close": {
            event.preventDefault();
            view.dispatch(view.state.tr.setMeta(commandListPluginKey, { close: true }));
            return true;
          }
          case "command-navigate": {
            event.preventDefault();
            commandListStore.navigateRef.current?.(action.direction);
            return true;
          }
          case "ask-user-arrow": {
            event.preventDefault();
            const optionsHandle = askUserRef.current.optionsRef.current;
            optionsHandle?.navigate(action.direction);
            view.dom.blur();
            return true;
          }
          case "remove-last-attachment": {
            event.preventDefault();
            const lastItem = attachmentsRef.current.items.at(-1);
            if (lastItem) attachmentsRef.current.remove(lastItem.id);
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
      askUserRef.current.optionsRef.current?.clearHighlight();
    },
    onMount: ({ editor: instance }) => {
      editorRef.current = instance;
    },
    onUnmount: () => {
      editorRef.current = null;
    },
    onUpdate: ({ editor: instance }) => {
      const text = instance.getText();
      editor.setHasContent(text.trim().length > 0 || !instance.isEmpty);
      if (text.trim().length > 0) {
        clearSelectionsIfSingle();
        askUserRef.current.optionsRef.current?.clearHighlight();
      }
      onValueChangeRef.current?.(text);
      reportEditorUpdate(instance);
      const pluginState = commandListPluginKey.getState(instance.state);
      commandListStore.setSnapshot({
        isOpen: pluginState?.isOpen ?? false,
        trigger: pluginState?.trigger ?? null,
        query: pluginState?.query ?? "",
      });
    },
    editable: !disabled,
    autofocus: autoFocus,
  });

  useEffect(() => {
    if (isControlled && tiptapEditor && value !== tiptapEditor.getText()) {
      tiptapEditor.commands.setContent(value);
      editor.setHasContent(value.trim().length > 0);
    }
  }, [value, tiptapEditor, isControlled, editor]);

  // Register the live editor with the shared controller (cleanup on unmount).
  useLayoutEffect(() => {
    if (!tiptapEditor) return;
    return registerComposerController(tiptapEditor);
  }, [tiptapEditor]);

  const placeholder = useMemo(() => {
    return Children.toArray(children).find(
      (child) => isValidElement(child) && child.type === ComposerPlaceholder,
    );
  }, [children]);

  return (
    <div
      data-slot="composer-textarea"
      className={cn(
        "max-h-32 min-h-8 overflow-y-auto py-2 px-3 text-md",
        "mask-[linear-gradient(to_bottom,transparent,black_16px,black_calc(100%-16px),transparent)]",
        disabled && "opacity-50 cursor-not-allowed",
        className,
      )}
    >
      {tiptapEditor !== null ? (
        <EditorContent editor={tiptapEditor} className="relative">
          {!editor.hasContent && placeholder && (
            <div
              data-slot="composer-placeholder"
              className="absolute inset-0 min-h-lh pointer-events-none"
              aria-hidden="true"
            >
              {placeholder}
            </div>
          )}
        </EditorContent>
      ) : null}
    </div>
  );
};

type ComposerPlaceholderProps =
  | { placeholder: string | string[]; children?: never; className?: string }
  | { placeholder?: never; children: ReactNode; className?: string };

const ComposerPlaceholder = ({ placeholder, children, className }: ComposerPlaceholderProps) => {
  const items = useMemo(() => {
    if (placeholder !== undefined) {
      return Array.isArray(placeholder) ? placeholder : [placeholder];
    }
    if (children) return Children.toArray(children);
    return [];
  }, [placeholder, children]);

  const isLooping = items.length > 1;

  const loopItems = useMemo(
    () => items.map((item) => (typeof item === "string" ? item : "")),
    [items],
  );
  const { currentItem, key } = useLoop(loopItems, 3000);

  if (!isLooping && items.length === 1) {
    return (
      <div className={cn("text-ink-tertiary font-[450] leading-[1.7]", className)}>{items[0]}</div>
    );
  }

  if (!isLooping && items.length === 0) return null;

  return (
    <div className="pointer-events-none flex">
      <AnimatePresence mode="popLayout" initial={false}>
        <motion.span
          key={key}
          initial={{ opacity: 0, y: "100%", filter: "blur(4px)" }}
          animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
          exit={{ opacity: 0, y: "-100%", filter: "blur(4px)" }}
          transition={{ duration: 0.3, ease: "easeOut" }}
          className={cn("text-ink-tertiary font-[450] leading-[1.7]", className)}
        >
          {typeof items[0] === "string" ? currentItem : items[key % items.length]}
        </motion.span>
      </AnimatePresence>
    </div>
  );
};

// ---------------------------------------------------------------------------
// Composer.Actions / Composer.Submit
// ---------------------------------------------------------------------------

type ComposerContextWindowProps = ComponentProps<"div">;

const ComposerContextWindow = ({ className, children, ...props }: ComposerContextWindowProps) => {
  const hasContent = Children.toArray(children).length > 0;
  return (
    <div
      data-slot="composer-context-window"
      className={cn(
        "relative overflow-hidden transition-all duration-200 px-3 text-xs",
        'before:content-[""] before:absolute before:inset-0 before:rounded-xl before:bg-ds-base before:pointer-events-none',
        hasContent ? "max-h-10 py-2 opacity-100" : "max-h-0 py-0 opacity-0",
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
};

const ComposerActions = ({ className, ...props }: ComponentProps<"div">) => (
  <div
    data-slot="composer-actions"
    className={cn("flex justify-end gap-2 p-2", className)}
    {...props}
  />
);

type ComposerSubmitProps = ComponentProps<typeof IconButton>;

const ComposerSubmit = ({ children, className, disabled, ...props }: ComposerSubmitProps) => {
  const { editor, attachments } = useComposer();

  const autoDisabled =
    disabled ?? ((!editor.hasContent && attachments.items.length === 0) || editor.isSubmitting);

  return (
    <IconButton
      type="submit"
      variant="accent"
      data-slot="composer-submit"
      className={cn("rounded-full", className)}
      disabled={autoDisabled}
      {...props}
    >
      {children ?? <SendIcon />}
    </IconButton>
  );
};

// ---------------------------------------------------------------------------
// Composer.Panel / Composer.PanelItem
// ---------------------------------------------------------------------------

type ComposerPanelProps = ComponentProps<"div"> & {
  value?: string;
};

const ComposerPanel = ({ children, className, value, ...props }: ComposerPanelProps) => {
  const isCommandListOpen = useCommandListSnapshot((snapshot) => snapshot.isOpen);
  const [contentRef, bounds] = useMeasure();

  // When a command-list prefix is active, route the panel to its
  // "command-list" item regardless of what the consumer passed.
  const effectiveValue = isCommandListOpen ? "command-list" : value;

  const matchedChild = effectiveValue
    ? Children.toArray(children).find(
        (child) =>
          isValidElement(child) && (child.props as { value?: string }).value === effectiveValue,
      )
    : null;
  const hasMatch = matchedChild != null;

  return (
    <div
      data-slot="composer-panel"
      className={cn("overflow-hidden transition-transform", hasMatch && "pb-2", className)}
      {...props}
    >
      <MotionConfig transition={{ duration: 0.3, type: "spring", bounce: 0 }}>
        <AnimatePresence initial={false}>
          {hasMatch && (
            <motion.div
              initial={{ y: "100%", opacity: 0 }}
              animate={{ y: 0, opacity: 1, height: bounds.height }}
              exit={{ y: "100%", opacity: 0 }}
              className="overflow-hidden box-content border border-primary-border bg-primary rounded-4xl shadow-xs [corner-shape:squircle]"
            >
              <div ref={contentRef} className="relative">
                <AnimatePresence mode="popLayout" initial={false}>
                  {matchedChild}
                </AnimatePresence>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </MotionConfig>
    </div>
  );
};

type ComposerPanelItemProps = Omit<ComponentProps<typeof motion.div>, "value"> & {
  value: string;
  children: ReactNode;
};

const ComposerPanelItem = ({ value, children, ...props }: ComposerPanelItemProps) => (
  <motion.div
    key={value}
    data-slot="composer-panel-item"
    initial={{ opacity: 0, filter: "blur(8px)" }}
    animate={{ opacity: 1, filter: "blur(0px)" }}
    exit={{ opacity: 0, filter: "blur(8px)" }}
    {...props}
  >
    {children}
  </motion.div>
);

// ---------------------------------------------------------------------------
// Composer.CommandList / CommandItem / CommandItemIcon / CommandGroup / etc.
// ---------------------------------------------------------------------------

type CommandListState = "loading" | "empty" | "ready";

// Nav slice — updates on arrow-key navigation. Consumed by `Composer.CommandItem`.
type CommandListNavContextValue = {
  highlightedValue: string | null;
  setHighlightedValue: (value: string | null) => void;
  selectByValue: (value: string) => void;
};

const CommandListNavContext = createContext<CommandListNavContextValue | null>(null);

// Items slice — updates on items resolution. Consumed by `Composer.CommandItems`.
// Split from nav so highlight changes don't re-render the items map, and items
// mutations don't re-render every CommandItem row.
type CommandListItemsContextValue = {
  items: CommandItemData[];
  state: CommandListState;
};

const CommandListItemsContext = createContext<CommandListItemsContextValue | null>(null);

const useResolvedItems = (
  itemsProp: ComposerCommandsItems,
  query: string,
  isActive: boolean,
): { items: CommandItemData[]; state: CommandListState } => {
  const isCallback = typeof itemsProp === "function";

  const [asyncState, setAsyncState] = useState<{
    items: CommandItemData[];
    loading: boolean;
  }>(() => ({ items: [], loading: isCallback }));

  useEffect(() => {
    if (typeof itemsProp !== "function") return;
    if (!isActive) return;

    const controller = new AbortController();
    let cancelled = false;

    let result: CommandItemData[] | Promise<CommandItemData[]>;
    try {
      result = itemsProp(query, { signal: controller.signal });
    } catch (error) {
      console.warn("Composer.commands items callback threw:", error);
      setAsyncState({ items: [], loading: false });
      return () => {
        cancelled = true;
        controller.abort();
      };
    }

    if (result instanceof Promise) {
      setAsyncState((previous) => ({ ...previous, loading: true }));
      result.then(
        (resolved) => {
          if (cancelled) return;
          setAsyncState({ items: resolved, loading: false });
        },
        (error) => {
          if (cancelled) return;
          if ((error as { name?: string })?.name === "AbortError") return;
          console.warn("Composer.commands items callback rejected:", error);
          setAsyncState((previous) => ({ ...previous, loading: false }));
        },
      );
    } else {
      setAsyncState({ items: result, loading: false });
    }

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [itemsProp, query, isActive]);

  if (Array.isArray(itemsProp)) {
    const items = filterArrayItems(itemsProp, query);
    return { items, state: items.length === 0 ? "empty" : "ready" };
  }

  if (asyncState.loading) {
    // Locally filter the most-recent resolved set so typing feels instant
    // while the new fetch is in flight. The server result replaces this once
    // it lands.
    return {
      items: filterArrayItems(asyncState.items, query),
      state: "loading",
    };
  }

  return {
    items: asyncState.items,
    state: asyncState.items.length === 0 ? "empty" : "ready",
  };
};

const EMPTY_ITEMS: CommandItemData[] = [];

type ComposerCommandListProps = {
  prefix: string;
  className?: string;
  children?: ReactNode;
};

const ComposerCommandList = ({ prefix, className, children }: ComposerCommandListProps) => {
  const { attachments } = useComposer();
  const internals = useComposerInternals();
  const { commandListStore } = internals;

  const isActive = useCommandListSnapshot(
    (snapshot) => snapshot.isOpen && snapshot.trigger === prefix,
  );
  const query = useCommandListSnapshot((snapshot) => snapshot.query);

  const config = internals.commands[prefix];
  const itemsProp = config?.items ?? EMPTY_ITEMS;
  const kind = config?.kind ?? "execute";

  const { items, state } = useResolvedItems(itemsProp, query, isActive);

  // Only the user's explicit choice (hover / arrow keys) is stored. The active
  // highlight is *derived* every render: honor the override while it still
  // points at a present item, otherwise fall back to the first row (or nothing
  // when the list is empty). The override may go stale as items change and the
  // derivation silently corrects it — so there is no setState during render.
  const [highlightOverride, setHighlightOverride] = useState<string | null>(null);

  const effectiveHighlight =
    highlightOverride !== null && items.some((item) => item.value === highlightOverride)
      ? highlightOverride
      : (items[0]?.value ?? null);

  const selectByValue = useCallback(
    (value: string) => {
      const editor = internals.editorRef.current;
      if (!editor) return;
      const dataItem = items.find((item) => item.value === value);
      if (!dataItem) return;

      const pluginState = commandListPluginKey.getState(editor.state);
      const triggerStartPosition = pluginState?.triggerStartPosition ?? 0;
      const cursorPosition = editor.state.selection.$from.pos;

      if (kind === "insert") {
        editor
          .chain()
          .focus()
          .deleteRange({ from: triggerStartPosition, to: cursorPosition })
          .insertContentAt(triggerStartPosition, {
            type: "mentionChip",
            attrs: {
              prefix,
              label: dataItem.label ?? dataItem.value,
              value: dataItem.value,
              icon: dataItem.icon ?? null,
              variant: dataItem.variant ?? null,
            },
          })
          .run();
      } else {
        editor
          .chain()
          .focus()
          .deleteRange({ from: triggerStartPosition, to: cursorPosition })
          .run();
        const onSelectContext: PrefixOnSelectContext = {
          editor: composerController,
          attachments: {
            add: attachments.add,
            remove: attachments.remove,
            openFileDialog: attachments.openFileDialog,
          },
        };
        dataItem.onSelect?.(onSelectContext);
      }

      editor.view.dispatch(editor.state.tr.setMeta(commandListPluginKey, { close: true }));
    },
    [internals, items, kind, prefix, attachments],
  );

  if (isActive) {
    commandListStore.selectRef.current = effectiveHighlight
      ? () => selectByValue(effectiveHighlight)
      : null;
    commandListStore.navigateRef.current = (direction: number) => {
      const next = computeNextHighlight(items, effectiveHighlight, direction === -1 ? -1 : 1);
      setHighlightOverride(next);
    };
  }

  const navContext = useMemo<CommandListNavContextValue>(
    () => ({
      highlightedValue: effectiveHighlight,
      setHighlightedValue: setHighlightOverride,
      selectByValue,
    }),
    [effectiveHighlight, selectByValue],
  );

  const itemsContext = useMemo<CommandListItemsContextValue>(
    () => ({ items, state }),
    [items, state],
  );

  if (!isActive) return null;

  return (
    <CommandListItemsContext.Provider value={itemsContext}>
      <CommandListNavContext.Provider value={navContext}>
        <div
          data-slot="composer-command-list"
          data-state={state}
          className={cn(
            "group/composer-command-list flex max-h-64 flex-col overflow-y-auto p-1",
            className,
          )}
        >
          {children}
        </div>
      </CommandListNavContext.Provider>
    </CommandListItemsContext.Provider>
  );
};

// ---------------------------------------------------------------------------
// Composer.CommandItems / CommandLoading / CommandEmpty
// ---------------------------------------------------------------------------

const useCommandListItems = <Item extends CommandItemData = CommandItemData>(): {
  items: Item[];
  state: CommandListState;
} => {
  const context = useContext(CommandListItemsContext);
  if (!context) {
    throw new Error("<Composer.CommandItems> must be rendered inside <Composer.CommandList>.");
  }
  return context as { items: Item[]; state: CommandListState };
};

type ComposerCommandItemsProps<Item extends CommandItemData> = {
  className?: string;
  children: (item: Item) => ReactNode;
};

const ComposerCommandItems = <Item extends CommandItemData>({
  className,
  children: renderItem,
}: ComposerCommandItemsProps<Item>): ReactNode => {
  const { items } = useCommandListItems<Item>();

  return (
    <div
      data-slot="composer-command-items"
      className={cn(
        "flex flex-col",
        "group-data-[state=empty]/composer-command-list:hidden",
        className,
      )}
    >
      {items.map((item, index) => (
        <Fragment key={item.value ?? `__cmd_${index}`}>{renderItem(item)}</Fragment>
      ))}
    </div>
  );
};

type ComposerCommandLoadingProps = ComponentProps<"div">;

const ComposerCommandLoading = ({ className, children, ...props }: ComposerCommandLoadingProps) => (
  <div
    data-slot="composer-command-loading"
    className={cn(
      "hidden group-data-[state=loading]/composer-command-list:flex",
      "items-center px-3 h-8 text-sm text-ink-tertiary",
      className,
    )}
    {...props}
  >
    {children ?? "Loading…"}
  </div>
);

type ComposerCommandEmptyProps = ComponentProps<"div">;

const ComposerCommandEmpty = ({ className, children, ...props }: ComposerCommandEmptyProps) => (
  <div
    data-slot="composer-command-empty"
    className={cn(
      "hidden group-data-[state=empty]/composer-command-list:flex",
      "items-center px-3 h-8 text-sm text-ink-tertiary",
      className,
    )}
    {...props}
  >
    {children ?? "No results"}
  </div>
);

type ComposerCommandItemProps = {
  value: string;
  children?: ReactNode;
};

const ComposerCommandItem = ({ value, children }: ComposerCommandItemProps) => {
  const navContext = useContext(CommandListNavContext);
  if (!navContext) {
    throw new Error("<Composer.CommandItem> must be rendered inside <Composer.CommandList>.");
  }

  const isHighlighted = navContext.highlightedValue === value;

  return (
    <Commands.Item
      data-slot="composer-command-item"
      highlighted={isHighlighted}
      onMouseDown={(event) => {
        event.preventDefault();
        navContext.selectByValue(value);
      }}
      onMouseEnter={() => navContext.setHighlightedValue(value)}
    >
      {children}
    </Commands.Item>
  );
};

const ComposerCommandItemIcon = ({ children, className, ...props }: ComponentProps<"span">) => (
  <span
    data-slot="composer-command-item-icon"
    className={cn(
      "inline-flex size-4 items-center justify-center text-ink-tertiary [&>svg]:size-4",
      className,
    )}
    {...props}
  >
    {children}
  </span>
);

const ComposerCommandItemLabel = ({ className, ...props }: ComponentProps<"span">) => (
  <span data-slot="composer-command-item-label" className={cn("text-sm", className)} {...props} />
);

const ComposerCommandItemDescription = ({ className, ...props }: ComponentProps<"span">) => (
  <span
    data-slot="composer-command-item-description"
    className={cn("text-xs text-ink-tertiary truncate", className)}
    {...props}
  />
);

const ComposerCommandGroup = ({ className, children, ...props }: ComponentProps<"div">) => (
  <Commands.Group className={className} {...props}>
    {children}
  </Commands.Group>
);

const ComposerCommandGroupLabel = ({ className, children, ...props }: ComponentProps<"div">) => (
  <div
    data-slot="composer-command-group-label"
    className={cn("px-2 pt-2 pb-1 text-xs font-medium text-ink-tertiary", className)}
    {...props}
  >
    {children}
  </div>
);

type ComposerCommandCollectionProps<Item> = {
  items: Item[];
  children: (item: Item) => ReactNode;
};

const ComposerCommandCollection = <Item,>({
  items,
  children: renderItem,
}: ComposerCommandCollectionProps<Item>): ReactNode => (
  <>
    {items.map((item, index) => (
      <Fragment key={(item as { value?: string } | null)?.value ?? `__col_${index}`}>
        {renderItem(item)}
      </Fragment>
    ))}
  </>
);

// ---------------------------------------------------------------------------
// Composer.Commands — default render for all registered command lists.
// Renders one CommandList per registered prefix with a sensible default item
// layout (icon + label). Drop down to <Composer.CommandList> for custom
// per-prefix rendering.
// ---------------------------------------------------------------------------

type ComposerCommandsProps = {
  className?: string;
};

const ComposerCommands = ({ className }: ComposerCommandsProps) => {
  const { commands } = useComposerInternals();
  const prefixes = Object.keys(commands);

  return (
    <>
      {prefixes.map((prefix) => (
        <ComposerCommandList key={prefix} prefix={prefix} className={className}>
          <ComposerCommandLoading />
          <ComposerCommandEmpty />
          <ComposerCommandItems>
            {(item) => (
              <ComposerCommandItem value={item.value}>
                {item.icon && (
                  <ComposerCommandItemIcon>{CHIP_ICONS[item.icon]}</ComposerCommandItemIcon>
                )}
                <ComposerCommandItemLabel>{item.label}</ComposerCommandItemLabel>
                {item.description && (
                  <ComposerCommandItemDescription>
                    {item.description}
                  </ComposerCommandItemDescription>
                )}
              </ComposerCommandItem>
            )}
          </ComposerCommandItems>
        </ComposerCommandList>
      ))}
    </>
  );
};

// ---------------------------------------------------------------------------
// Composer.AskUser (with sub-Parts) — default render for the ask-user flow
// registered via the `questions` prop on Composer Root.
// ---------------------------------------------------------------------------

const ComposerAskUser = () => {
  const { askUser } = useComposer();

  const question = askUser.questions?.[askUser.step] ?? null;
  const lastQuestionRef = useRef(question);
  if (question) lastQuestionRef.current = question;
  const display = question ?? lastQuestionRef.current;

  if (!display) return null;

  const entry = askUser.answers.get(askUser.step) ?? {
    selected: new Set<string>(),
    freeText: "",
  };

  const totalQuestions = askUser.questions?.length ?? 0;

  return (
    <AskUser>
      <AskUser.Header>
        <AskUser.Label>{display.question}</AskUser.Label>
        {!askUser.isSingle && totalQuestions > 1 && (
          <AskUser.Navigation>
            <AskUser.Previous onClick={askUser.goBack} disabled={askUser.step === 0} />
            <AskUser.StepLabel current={askUser.step + 1} total={totalQuestions} />
            <AskUser.Next onClick={askUser.goNext} disabled={askUser.step === totalQuestions - 1} />
          </AskUser.Navigation>
        )}
      </AskUser.Header>
      {display.options && (
        <AskUser.Options
          ref={askUser.optionsRef}
          multiSelect={!!display.multiSelect}
          groupName={`q-${askUser.step}`}
          value={[...entry.selected][0] ?? ""}
          onValueChange={(value) => askUser.toggleOption(askUser.step, value, false)}
        >
          {display.options.map((option) => (
            <AskUser.Option
              key={option.label}
              value={option.label}
              selected={entry.selected.has(option.label)}
              onSelect={() =>
                askUser.toggleOption(askUser.step, option.label, !!display.multiSelect)
              }
            >
              <AskUser.OptionInput />
              <AskUser.OptionContent>
                <AskUser.OptionLabel>{option.label}</AskUser.OptionLabel>
                {option.description && (
                  <AskUser.OptionDescription>{option.description}</AskUser.OptionDescription>
                )}
              </AskUser.OptionContent>
            </AskUser.Option>
          ))}
        </AskUser.Options>
      )}
    </AskUser>
  );
};

const ComposerAskUserHints = ({ className, ...props }: ComponentProps<typeof AskUser.Hints>) => {
  const { askUser } = useComposer();
  const totalQuestions = askUser.questions?.length ?? 0;

  return (
    <AskUser.Hints className={cn("flex-1", className)} {...props}>
      <span className="inline-flex items-center gap-1">
        <Kbd size="sm">↑</Kbd>
        <Kbd size="sm">↓</Kbd> navigate
      </span>
      <span className="inline-flex items-center gap-1">
        <Kbd size="sm">↵</Kbd> select
      </span>
      {!askUser.isSingle && totalQuestions > 1 && (
        <span className="inline-flex items-center gap-1">
          <Kbd size="sm">←</Kbd>
          <Kbd size="sm">→</Kbd> between questions
        </span>
      )}
      <span className="inline-flex items-center gap-1">
        <Kbd size="sm">esc</Kbd> skip
      </span>
    </AskUser.Hints>
  );
};

type ComposerAskUserDismissProps = ComponentProps<typeof Button>;

const ComposerAskUserDismiss = ({ className, ...props }: ComposerAskUserDismissProps) => {
  const { askUser } = useComposer();
  return (
    <Button
      type="button"
      variant="ghost"
      data-slot="composer-ask-user-dismiss"
      className={cn("gap-2", className)}
      onClick={askUser.dismissStep}
      {...props}
    >
      Dismiss
      <Kbd size="sm">ESC</Kbd>
    </Button>
  );
};

type ComposerAskUserContinueProps = ComponentProps<typeof Button>;

const ComposerAskUserContinue = ({ className, ...props }: ComposerAskUserContinueProps) => {
  const { askUser } = useComposer();
  return (
    <Button
      type="submit"
      variant="tertiary"
      data-slot="composer-ask-user-continue"
      className={cn("gap-2", className)}
      {...props}
    >
      {askUser.isLastStep ? "Submit" : "Continue"}
      <Kbd size="sm">↵</Kbd>
    </Button>
  );
};

// ---------------------------------------------------------------------------
// Compound export
// ---------------------------------------------------------------------------

export const Composer = Object.assign(ComposerRoot, {
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
  CommandItem: ComposerCommandItem,
  CommandItemIcon: ComposerCommandItemIcon,
  CommandItemLabel: ComposerCommandItemLabel,
  CommandItemDescription: ComposerCommandItemDescription,
  CommandGroup: ComposerCommandGroup,
  CommandGroupLabel: ComposerCommandGroupLabel,
  CommandCollection: ComposerCommandCollection,
});
