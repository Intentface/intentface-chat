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
  type Ref,
  type RefObject,
  useCallback,
  useContext,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from "react";
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
import { Commands } from "@/components/ai/commands";
import type { AskUserQuestion } from "@/components/ai/types";
import { SendIcon } from "@/components/icons/send";
import {
  Questionnaire,
  type QuestionnaireOptionsHandle,
} from "@/components/questionnaire";
import Button from "@/components/ui/button";
import { IconButton } from "@/components/ui/icon-button";
import { Kbd } from "@/components/ui/kbd";
import { useLoop } from "@/hooks/use-loop";
import { useMeasure } from "@/hooks/use-measure";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export type PrefixKind = "chip" | "command";

export type TriggerRule = "doc-start" | "after-whitespace";

export type ChipData = {
  prefix: string;
  value: string;
  label: string;
};

export type ComposerEditorHandle = {
  focus: () => void;
  blur: () => void;
  clear: () => void;
  insertText: (text: string) => void;
  insertChip: (chip: ChipData) => void;
};

export type ToolsApi = {
  values: Record<string, boolean>;
  set: (name: string, value: boolean) => void;
  toggle: (name: string) => void;
};

export type AttachmentsApi = {
  add: (files: File[] | FileList) => void;
  remove: (id: string) => void;
  openFileDialog: () => void;
};

export type PrefixOnSelectContext = {
  editor: ComposerEditorHandle;
  tools: ToolsApi;
  attachments: AttachmentsApi;
};

export type CommandItemData = {
  value: string;
  label: string;
  description?: string;
  icon?: ReactNode;
  keywords?: string;
  onSelect?: (context: PrefixOnSelectContext) => void;
};

export type ComposerSnapshot = {
  readonly __pmDoc: object;
  readonly __brand: "ComposerSnapshot";
};

export type ComposerHandle = {
  focus: () => void;
  blur: () => void;
  clear: () => void;
  insertText: (text: string) => void;
  insertChip: (chip: ChipData) => void;
  getSnapshot: () => ComposerSnapshot;
  setSnapshot: (snapshot: ComposerSnapshot) => void;
};

export type ComposerMessageSubmit = {
  kind: "message";
  text: string;
  files: FileUIPart[];
  chips: ChipData[];
  tools: Record<string, boolean>;
};

export type ComposerAnswersSubmit = {
  kind: "answers";
  answers: Record<string, string>;
};

export type ComposerSubmitData = ComposerMessageSubmit | ComposerAnswersSubmit;

export type ComposerCommandsConfig = {
  kind: PrefixKind;
  triggerRule: TriggerRule;
  items: CommandItemData[];
  filter?: ((item: CommandItemData, query: string) => number) | null;
};

export type ComposerCommandsMap = Record<string, ComposerCommandsConfig>;

// ---------------------------------------------------------------------------
// Pure helpers — fuzzy filtering
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

const defaultItemFilter = (item: unknown, query: string): number => {
  if (!query) return 1;
  if (item == null || typeof item !== "object") return 0;
  const record = item as { label?: string; value?: string; keywords?: string };
  const label = record.label ?? record.value ?? "";
  const keywords = record.keywords ?? "";
  const target = `${label} ${keywords}`.trim();
  return fuzzyScore(query, target);
};

const filterCommandItems = <TItem,>(
  items: TItem[],
  query: string,
  filter: ((item: TItem, query: string) => number) | null | undefined,
): TItem[] => {
  if (filter === null) return items;
  if (!query) return items;
  const score =
    filter ?? (defaultItemFilter as (i: TItem, q: string) => number);
  return items
    .map((item) => ({ item, score: score(item, query) }))
    .filter(({ score: itemScore }) => itemScore > 0)
    .sort((a, b) => b.score - a.score)
    .map(({ item }) => item);
};

// ---------------------------------------------------------------------------
// Pure helpers — command-list trigger detection
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

const escapeRegex = (input: string) =>
  input.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const detectActivePrefix = (args: {
  registered: RegisteredPrefix[];
  blockStart: number;
  cursorPosition: number;
  textBeforeCursor: string;
  fullDocText: string;
}): CommandListPluginState => {
  const {
    registered,
    blockStart,
    cursorPosition,
    textBeforeCursor,
    fullDocText,
  } = args;

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
      const triggerStartPosition =
        cursorPosition - query.length - entry.prefix.length;
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

// ---------------------------------------------------------------------------
// Pure helpers — keyboard interpreters
// ---------------------------------------------------------------------------

type EditorKeyAction =
  | { type: "command-select" }
  | { type: "command-close" }
  | { type: "command-navigate"; direction: 1 | -1 }
  | { type: "questionnaire-arrow"; direction: 1 | -1 }
  | { type: "remove-last-attachment" }
  | { type: "submit-form" }
  | { type: "soft-break" };

const interpretEditorKey = (
  event: { key: string; shiftKey: boolean },
  context: {
    isCommandListOpen: boolean;
    hasActiveQuestionnaire: boolean;
    isEditorEmpty: boolean;
    hasAttachments: boolean;
  },
): EditorKeyAction | null => {
  if (context.isCommandListOpen) {
    if (event.key === "Tab") return { type: "command-select" };
    if (event.key === "Escape") return { type: "command-close" };
    if (event.key === "ArrowUp")
      return { type: "command-navigate", direction: -1 };
    if (event.key === "ArrowDown")
      return { type: "command-navigate", direction: 1 };
    if (event.key === "Enter" && !event.shiftKey)
      return { type: "command-select" };
  }

  if (context.hasActiveQuestionnaire) {
    if (event.key === "ArrowUp")
      return { type: "questionnaire-arrow", direction: -1 };
    if (event.key === "ArrowDown")
      return { type: "questionnaire-arrow", direction: 1 };
  }

  if (
    event.key === "Backspace" &&
    context.isEditorEmpty &&
    context.hasAttachments
  ) {
    return { type: "remove-last-attachment" };
  }

  if (event.key === "Enter" && !event.shiftKey) return { type: "submit-form" };
  if (event.key === "Enter" && event.shiftKey) return { type: "soft-break" };

  return null;
};

type QuestionnaireKeyAction =
  | { type: "dismiss-step" }
  | { type: "navigate-options"; direction: 1 | -1 }
  | { type: "select-option" }
  | { type: "go-back" }
  | { type: "go-next" }
  | { type: "insert-character"; character: string };

const interpretQuestionnaireKey = (
  event: {
    key: string;
    ctrlKey: boolean;
    metaKey: boolean;
    altKey: boolean;
    defaultPrevented: boolean;
  },
  context: { hasHighlight: boolean },
): QuestionnaireKeyAction | null => {
  if (event.defaultPrevented) return null;
  if (event.key === "Escape") return { type: "dismiss-step" };
  if (!context.hasHighlight) return null;

  if (event.key === "ArrowUp")
    return { type: "navigate-options", direction: -1 };
  if (event.key === "ArrowDown")
    return { type: "navigate-options", direction: 1 };
  if (event.key === "Enter") return { type: "select-option" };
  if (event.key === "ArrowLeft") return { type: "go-back" };
  if (event.key === "ArrowRight") return { type: "go-next" };

  if (
    event.key.length === 1 &&
    !event.ctrlKey &&
    !event.metaKey &&
    !event.altKey
  ) {
    return { type: "insert-character", character: event.key };
  }
  return null;
};

const computeNextHighlight = (
  rows: Array<{ value: string }>,
  current: string | null,
  direction: 1 | -1,
): string | null => {
  if (rows.length === 0) return null;
  const currentIndex =
    current === null ? -1 : rows.findIndex((row) => row.value === current);
  const nextIndex =
    currentIndex === -1
      ? 0
      : (currentIndex + direction + rows.length) % rows.length;
  return rows[nextIndex].value;
};

// ---------------------------------------------------------------------------
// Pure helpers — attachment store
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

      const accepted = incoming.filter((file) =>
        matchesAccept(file, config.accept),
      );
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
// Pure helpers — questionnaire reducer
// ---------------------------------------------------------------------------

type AnswerEntry = {
  selected: Set<string>;
  freeText: string;
};

type QuestionnaireState = {
  step: number;
  answers: Map<number, AnswerEntry>;
};

const INITIAL_QUESTIONNAIRE_STATE: QuestionnaireState = {
  step: 0,
  answers: new Map(),
};

type QuestionnaireAction =
  | { type: "reset" }
  | {
      type: "toggle-option";
      step: number;
      label: string;
      multiSelect: boolean;
    }
  | { type: "clear-selections"; step: number }
  | {
      type: "save-and-advance";
      step: number;
      text?: string;
      multiSelect: boolean;
    }
  | { type: "dismiss-step"; step: number }
  | {
      type: "save-and-navigate";
      fromStep: number;
      text: string;
      targetStep: number;
    };

const emptyEntry = (): AnswerEntry => ({
  selected: new Set<string>(),
  freeText: "",
});

const cloneAnswers = (
  source: Map<number, AnswerEntry>,
): Map<number, AnswerEntry> => new Map(source);

const questionnaireReducer = (
  state: QuestionnaireState,
  action: QuestionnaireAction,
): QuestionnaireState => {
  switch (action.type) {
    case "reset":
      return INITIAL_QUESTIONNAIRE_STATE;
    case "toggle-option": {
      const next = cloneAnswers(state.answers);
      const previous = next.get(action.step) ?? emptyEntry();
      const selected = new Set(previous.selected);
      if (action.multiSelect) {
        if (selected.has(action.label)) selected.delete(action.label);
        else selected.add(action.label);
      } else {
        selected.clear();
        selected.add(action.label);
      }
      next.set(action.step, {
        selected,
        freeText: action.multiSelect ? previous.freeText : "",
      });
      return { ...state, answers: next };
    }
    case "clear-selections": {
      const previous = state.answers.get(action.step);
      if (!previous || previous.selected.size === 0) return state;
      const next = cloneAnswers(state.answers);
      next.set(action.step, {
        selected: new Set(),
        freeText: previous.freeText,
      });
      return { ...state, answers: next };
    }
    case "save-and-advance": {
      const next = cloneAnswers(state.answers);
      if (action.text && action.text.length > 0) {
        const previous = next.get(action.step) ?? emptyEntry();
        next.set(action.step, {
          selected: action.multiSelect ? previous.selected : new Set(),
          freeText: action.text,
        });
      }
      return { step: state.step + 1, answers: next };
    }
    case "dismiss-step": {
      const next = cloneAnswers(state.answers);
      next.delete(action.step);
      return { step: state.step + 1, answers: next };
    }
    case "save-and-navigate": {
      const next = cloneAnswers(state.answers);
      if (action.text.length > 0) {
        const previous = next.get(action.fromStep) ?? emptyEntry();
        next.set(action.fromStep, {
          ...previous,
          freeText: action.text,
        });
      }
      return { step: action.targetStep, answers: next };
    }
  }
};

const compileAnswers = (
  state: QuestionnaireState,
  questions: AskUserQuestion[],
): Record<string, string> => {
  const result: Record<string, string> = {};
  for (let index = 0; index < questions.length; index++) {
    const entry = state.answers.get(index);
    result[questions[index].question] = !entry
      ? ""
      : entry.selected.size > 0
        ? [...entry.selected].join(", ")
        : entry.freeText.trim();
  }
  return result;
};

const isLastStep = (
  state: QuestionnaireState,
  questions: AskUserQuestion[],
): boolean => state.step >= questions.length - 1;

// ---------------------------------------------------------------------------
// Pure helpers — drag handlers
// ---------------------------------------------------------------------------

const createDragHandlers = (callbacks: {
  isInScope: (event: DragEvent) => boolean;
  onFiles: (files: FileList) => void;
  setDragging: (active: boolean) => void;
}) => {
  const counter = { current: 0 };
  const carriesFiles = (event: DragEvent) =>
    event.dataTransfer?.types?.includes("Files") ?? false;

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
// Pure helpers — snapshot
// ---------------------------------------------------------------------------

const EMPTY_SNAPSHOT: ComposerSnapshot = {
  __pmDoc: { type: "doc", content: [{ type: "paragraph" }] },
  __brand: "ComposerSnapshot",
} as ComposerSnapshot;

const snapshotFromEditor = (editor: Editor): ComposerSnapshot =>
  ({
    __pmDoc: editor.getJSON(),
    __brand: "ComposerSnapshot",
  }) as ComposerSnapshot;

const applySnapshotToEditor = (
  editor: Editor,
  snapshot: ComposerSnapshot,
): void => {
  editor.commands.setContent(snapshot.__pmDoc as never);
};

const extractChipsFromEditor = (editor: Editor): ChipData[] => {
  const chips: ChipData[] = [];
  editor.state.doc.descendants((node) => {
    if (node.type.name !== "mentionChip") return;
    const attrs = node.attrs as {
      prefix?: string;
      value?: string;
      label?: string;
    };
    chips.push({
      prefix: attrs.prefix ?? "",
      value: attrs.value ?? "",
      label: attrs.label ?? "",
    });
  });
  return chips;
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

type ComposerToolsState = {
  values: Record<string, boolean>;
  set: (name: string, value: boolean) => void;
  toggle: (name: string) => void;
};

type ComposerQuestionnaireState = {
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
  optionsRef: RefObject<QuestionnaireOptionsHandle | null>;
};

type ComposerCommandListState = {
  open: boolean;
  currentPrefix: string | null;
  query: string;
  selectRef: RefObject<(() => void) | null>;
  navigateRef: RefObject<((direction: number) => void) | null>;
};

type ComposerCommandsApi = {
  lookup: (prefix: string, value: string) => CommandItemData | undefined;
};

type ComposerContextValue = {
  editor: ComposerEditorState;
  attachments: ComposerAttachmentsState;
  tools: ComposerToolsState;
  questionnaire: ComposerQuestionnaireState;
  commandList: ComposerCommandListState;
  commands: ComposerCommandsApi;
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
  syncCommandListState: (state: {
    isOpen: boolean;
    trigger: string | null;
    query: string;
  }) => void;
  getRegisteredPrefixes: () => RegisteredPrefix[];
  reportEditorUpdate: (editor: Editor) => void;
};

const ComposerInternalsContext = createContext<ComposerInternalsValue | null>(
  null,
);

const useComposerInternals = (): ComposerInternalsValue => {
  const context = useContext(ComposerInternalsContext);
  if (!context) {
    throw new Error(
      "useComposerInternals must be called inside a <Composer> subtree.",
    );
  }
  return context;
};

// ---------------------------------------------------------------------------
// TipTap mention-chip extension
// ---------------------------------------------------------------------------

const commandListPluginKey = new PluginKey<CommandListPluginState>(
  "commandList",
);

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
  const classes = pluginState.query
    ? BADGE_CLASSES
    : `${BADGE_CLASSES} ${PLACEHOLDER_CLASSES}`;
  const inline = Decoration.inline(triggerStart, cursorPosition, {
    class: classes,
  });
  return DecorationSet.create(state.doc, [inline]);
};

const createCommandListPlugin = (
  getRegisteredPrefixes: () => RegisteredPrefix[],
) =>
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
        const textBeforeCursor = newEditorState.doc.textBetween(
          blockStart,
          cursorPosition,
          "\n",
        );
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

const MentionChipNodeView = ({
  node,
}: {
  node: { attrs: Record<string, unknown> };
}) => {
  const { commands } = useComposer();
  const prefix = node.attrs.prefix as string;
  const value = node.attrs.value as string;
  const label = node.attrs.label as string;

  const item = commands.lookup(prefix, value);
  const icon = item?.icon;

  return (
    <NodeViewWrapper
      as="span"
      data-mention-chip
      className="inline-flex items-center gap-0.5"
    >
      {icon && (
        <span
          aria-hidden
          className="relative w-4 h-[1em] text-ink-tertiary [&>svg]:absolute [&>svg]:top-1/2 [&>svg]:left-0 [&>svg]:size-4 [&>svg]:-translate-y-1/2"
        >
          {icon}
        </span>
      )}
      <span>{label}</span>
    </NodeViewWrapper>
  );
};

const createMentionChipExtension = (
  getRegisteredPrefixes: () => RegisteredPrefix[],
) =>
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
      };
    },

    parseHTML() {
      return [{ tag: "span[data-mention-chip]" }];
    },

    renderHTML({ HTMLAttributes }) {
      return [
        "span",
        mergeAttributes({ "data-mention-chip": "" }, HTMLAttributes),
        0,
      ];
    },

    addNodeView() {
      return ReactNodeViewRenderer(MentionChipNodeView, {
        className:
          "inline-flex items-center gap-0.5 h-6 rounded-sm bg-primary-hover px-0.75 font-[450] leading-[normal] text-ink-primary align-[-1px] select-none [text-box:trim-both_cap_alphabetic]",
      });
    },

    addProseMirrorPlugins() {
      return [createCommandListPlugin(getRegisteredPrefixes)];
    },
  });

// ---------------------------------------------------------------------------
// Hooks
// ---------------------------------------------------------------------------

const useAttachmentStore = (configRef: RefObject<AttachmentStoreConfig>) => {
  const [state, setState] = useState<AttachmentStoreState>(
    INITIAL_ATTACHMENT_STATE,
  );

  const add = useCallback(
    (files: File[] | FileList) => {
      setState((current) =>
        attachmentReducer(current, { type: "add", files }, configRef.current),
      );
    },
    [configRef],
  );

  const remove = useCallback(
    (id: string) => {
      setState((current) =>
        attachmentReducer(current, { type: "remove", id }, configRef.current),
      );
    },
    [configRef],
  );

  const reset = useCallback(() => {
    setState((current) =>
      attachmentReducer(current, { type: "reset" }, configRef.current),
    );
  }, [configRef]);

  return useMemo(
    () => ({ items: state.items, error: state.error, add, remove, reset }),
    [state.items, state.error, add, remove, reset],
  );
};

const useToolsState = (options: {
  defaultTools?: Record<string, boolean>;
  tools?: Record<string, boolean>;
  onToolsChange?: (values: Record<string, boolean>) => void;
}): ComposerToolsState => {
  const isControlled = options.tools !== undefined;
  const [internal, setInternal] = useState<Record<string, boolean>>(
    options.defaultTools ?? {},
  );

  const values = isControlled ? (options.tools ?? {}) : internal;
  const valuesRef = useRef(values);
  valuesRef.current = values;

  const onToolsChangeRef = useRef(options.onToolsChange);
  onToolsChangeRef.current = options.onToolsChange;

  const set = useCallback(
    (name: string, value: boolean) => {
      const next = { ...valuesRef.current, [name]: value };
      onToolsChangeRef.current?.(next);
      if (!isControlled) setInternal(next);
    },
    [isControlled],
  );

  const toggle = useCallback(
    (name: string) => {
      const current = valuesRef.current[name] ?? false;
      const next = { ...valuesRef.current, [name]: !current };
      onToolsChangeRef.current?.(next);
      if (!isControlled) setInternal(next);
    },
    [isControlled],
  );

  return useMemo(() => ({ values, set, toggle }), [values, set, toggle]);
};

const useCommandRegistry = (commands: ComposerCommandsMap) => {
  const registryRef = useRef(commands);
  registryRef.current = commands;

  const getRegisteredPrefixes = useCallback((): RegisteredPrefix[] => {
    const result: RegisteredPrefix[] = [];
    for (const [prefix, entry] of Object.entries(registryRef.current)) {
      result.push({ prefix, triggerRule: entry.triggerRule });
    }
    return result;
  }, []);

  const api = useMemo<ComposerCommandsApi>(
    () => ({
      lookup: (prefix, value) => {
        const entry = commands[prefix];
        if (!entry) return undefined;
        return entry.items.find((item) => item.value === value);
      },
    }),
    [commands],
  );

  return { api, getRegisteredPrefixes };
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

  const onFilesRef = useRef(onFiles);
  onFilesRef.current = onFiles;

  useEffect(() => {
    const isInScope = (event: DragEvent) =>
      globalDropRef.current ||
      (rootRef.current?.contains(event.target as Node) ?? false);

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

const useQuestionnaire = ({
  editorRef,
  optionsRef,
  setEditorHasContent,
  submitAnswers,
  questions,
}: {
  editorRef: RefObject<Editor | null>;
  optionsRef: RefObject<QuestionnaireOptionsHandle | null>;
  setEditorHasContent: (value: boolean) => void;
  submitAnswers: (answers: Record<string, string>) => void;
  questions: AskUserQuestion[] | undefined;
}) => {
  const [reducerState, setReducerState] = useState<QuestionnaireState>(
    INITIAL_QUESTIONNAIRE_STATE,
  );

  const stateRef = useRef(reducerState);
  stateRef.current = reducerState;
  const questionsRef = useRef<AskUserQuestion[] | null>(questions ?? null);
  questionsRef.current = questions ?? null;

  const submitAnswersRef = useRef(submitAnswers);
  submitAnswersRef.current = submitAnswers;

  // Reset reducer state and blur editor when the questions identity changes.
  const previousQuestionsRef = useRef(questions);
  if (previousQuestionsRef.current !== questions) {
    previousQuestionsRef.current = questions;
    setReducerState(INITIAL_QUESTIONNAIRE_STATE);
    if (questions && questions.length > 0) editorRef.current?.commands.blur();
  }

  const toggleOption = useCallback(
    (step: number, label: string, multiSelect: boolean) => {
      setReducerState((current) =>
        questionnaireReducer(current, {
          type: "toggle-option",
          step,
          label,
          multiSelect,
        }),
      );
      if (!multiSelect) {
        editorRef.current?.commands.setContent("");
        setEditorHasContent(false);
      }
    },
    [editorRef, setEditorHasContent],
  );

  const clearSelections = useCallback((step: number) => {
    setReducerState((current) =>
      questionnaireReducer(current, { type: "clear-selections", step }),
    );
  }, []);

  const continueStep = useCallback(
    (freeText?: string) => {
      const activeQuestions = questionsRef.current;
      if (!activeQuestions || activeQuestions.length === 0) return;

      const text = freeText?.trim() ?? "";
      const currentStep = stateRef.current.step;
      const currentQuestion = activeQuestions[currentStep];
      const multiSelect = !!currentQuestion?.multiSelect;

      const advanced = questionnaireReducer(stateRef.current, {
        type: "save-and-advance",
        step: currentStep,
        text: text.length > 0 ? text : undefined,
        multiSelect,
      });
      setReducerState(advanced);

      editorRef.current?.commands.setContent("");
      setEditorHasContent(false);

      if (currentStep < activeQuestions.length - 1) {
        optionsRef.current?.resetHighlight();
        editorRef.current?.commands.blur();
      } else {
        submitAnswersRef.current(compileAnswers(advanced, activeQuestions));
        editorRef.current?.commands.focus();
      }
    },
    [editorRef, optionsRef, setEditorHasContent],
  );

  const dismissStep = useCallback(() => {
    const activeQuestions = questionsRef.current;
    if (!activeQuestions || activeQuestions.length === 0) return;

    const currentStep = stateRef.current.step;
    const advanced = questionnaireReducer(stateRef.current, {
      type: "dismiss-step",
      step: currentStep,
    });
    setReducerState(advanced);

    editorRef.current?.commands.setContent("");
    setEditorHasContent(false);

    if (currentStep < activeQuestions.length - 1) {
      optionsRef.current?.resetHighlight();
      editorRef.current?.commands.blur();
    } else {
      submitAnswersRef.current(compileAnswers(advanced, activeQuestions));
      editorRef.current?.commands.focus();
    }
  }, [editorRef, optionsRef, setEditorHasContent]);

  const transitionStep = useCallback(
    (targetStep: number) => {
      const currentStep = stateRef.current.step;
      if (targetStep === currentStep) return;

      const currentText = editorRef.current?.getText()?.trim() ?? "";
      const navigated = questionnaireReducer(stateRef.current, {
        type: "save-and-navigate",
        fromStep: currentStep,
        text: currentText,
        targetStep,
      });
      setReducerState(navigated);

      const targetEntry = navigated.answers.get(targetStep);
      const targetFreeText = targetEntry?.freeText ?? "";
      editorRef.current?.commands.setContent(targetFreeText);
      setEditorHasContent(targetFreeText.length > 0);
      optionsRef.current?.resetHighlight();
      editorRef.current?.commands.blur();
    },
    [editorRef, optionsRef, setEditorHasContent],
  );

  const goBack = useCallback(() => {
    transitionStep(Math.max(0, stateRef.current.step - 1));
  }, [transitionStep]);

  const goNext = useCallback(() => {
    const activeQuestions = questionsRef.current;
    if (!activeQuestions) return;
    transitionStep(
      Math.min(activeQuestions.length - 1, stateRef.current.step + 1),
    );
  }, [transitionStep]);

  const isLast = useMemo(
    () => (questions ? isLastStep(reducerState, questions) : false),
    [reducerState, questions],
  );
  const isSingle = useMemo(
    () => (questions ? questions.length === 1 : false),
    [questions],
  );

  const state: ComposerQuestionnaireState = useMemo(
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
}): { reportUpdate: (editor: Editor) => void } => {
  const isControlled = value !== undefined;
  const lastAppliedRef = useRef<ComposerSnapshot | null>(null);
  const initializedRef = useRef(false);

  const onValueChangeRef = useRef(onValueChange);
  onValueChangeRef.current = onValueChange;

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

  const reportUpdate = (editor: Editor) => {
    if (!onValueChangeRef.current) return;
    const snapshot = snapshotFromEditor(editor);
    lastAppliedRef.current = snapshot;
    onValueChangeRef.current(snapshot);
  };

  return { reportUpdate };
};

// ---------------------------------------------------------------------------
// Composer.Root
// ---------------------------------------------------------------------------

const EMPTY_COMMANDS: ComposerCommandsMap = {};

export type ComposerRootProps = Omit<ComponentProps<"form">, "onSubmit"> & {
  onSubmit?: (data: ComposerSubmitData) => void | Promise<void>;
  isSubmitting?: boolean;
  commands?: ComposerCommandsMap;
  questions?: AskUserQuestion[];
  defaultTools?: Record<string, boolean>;
  tools?: Record<string, boolean>;
  onToolsChange?: (values: Record<string, boolean>) => void;
  defaultValue?: ComposerSnapshot;
  value?: ComposerSnapshot;
  onValueChange?: (snapshot: ComposerSnapshot) => void;
  ref?: Ref<ComposerHandle>;
};

const ComposerRoot = ({
  children,
  className,
  onSubmit,
  isSubmitting = false,
  commands = EMPTY_COMMANDS,
  questions,
  defaultTools,
  tools: controlledTools,
  onToolsChange,
  defaultValue,
  value,
  onValueChange,
  ref,
  ...formProps
}: ComposerRootProps) => {
  const editorRef = useRef<Editor | null>(null);
  const formRef = useRef<HTMLFormElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const globalDropRef = useRef(false);
  const commandListSelectRef = useRef<(() => void) | null>(null);
  const commandListNavigateRef = useRef<((direction: number) => void) | null>(
    null,
  );
  const questionnaireOptionsRef = useRef<QuestionnaireOptionsHandle | null>(
    null,
  );
  const attachmentConfigRef = useRef<AttachmentStoreConfig>({
    accept: DEFAULT_ATTACHMENT_ACCEPT,
    maxFiles: DEFAULT_ATTACHMENT_MAX_FILES,
    maxFileSize: DEFAULT_ATTACHMENT_MAX_FILE_SIZE,
  });

  const [editorHasContent, setEditorHasContent] = useState(false);
  const [commandListState, setCommandListState] = useState<{
    isOpen: boolean;
    trigger: string | null;
    query: string;
  }>({ isOpen: false, trigger: null, query: "" });

  const attachments = useAttachmentStore(attachmentConfigRef);

  const tools = useToolsState({
    defaultTools,
    tools: controlledTools,
    onToolsChange,
  });

  const onSubmitRef = useRef(onSubmit);
  onSubmitRef.current = onSubmit;

  const submitAnswers = useCallback((answers: Record<string, string>) => {
    onSubmitRef.current?.({ kind: "answers", answers });
  }, []);

  const questionnaire = useQuestionnaire({
    editorRef,
    optionsRef: questionnaireOptionsRef,
    setEditorHasContent,
    submitAnswers,
    questions,
  });

  const { api: commandsApi, getRegisteredPrefixes } =
    useCommandRegistry(commands);

  const { isDragging } = useDragDropFiles({
    rootRef: formRef,
    globalDropRef,
    onFiles: attachments.add,
  });

  const { reportUpdate: reportEditorUpdate } = useComposerSnapshot({
    editorRef,
    defaultValue,
    value,
    onValueChange,
  });

  const questionnaireRef = useRef(questionnaire);
  questionnaireRef.current = questionnaire;

  useEffect(() => {
    if ((questionnaire.questions?.length ?? 0) === 0) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      const optionsHandle = questionnaireOptionsRef.current;
      const action = interpretQuestionnaireKey(
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
      const current = questionnaireRef.current;
      switch (action.type) {
        case "dismiss-step":
          current.dismissStep();
          return;
        case "navigate-options": {
          const newValue = optionsHandle?.navigate(action.direction);
          if (newValue === null) editorRef.current?.commands.focus();
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
          const editorInstance = editorRef.current;
          editorInstance?.commands.focus();
          editorInstance?.commands.insertContent(action.character);
          return;
        }
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [questionnaire.questions]);

  const handleFormSubmit = async (
    event: React.SubmitEvent<HTMLFormElement>,
  ) => {
    event.preventDefault();

    if (questionnaire.questions?.length) {
      const text = editorRef.current?.getText()?.trim() ?? "";
      editorRef.current?.commands.setContent("");
      setEditorHasContent(false);
      questionnaire.continueStep(text);
      return;
    }

    if (isSubmitting) return;

    const text = editorRef.current?.getText()?.trim() ?? "";
    if (!text && !attachments.items.length) return;

    const submitText = text || "Sent with attachments";
    const fileItems: AttachmentItem[] = attachments.items;
    const fileParts =
      fileItems.length > 0 ? await prepareAttachmentsForSend(fileItems) : [];
    const chips: ChipData[] = editorRef.current
      ? extractChipsFromEditor(editorRef.current)
      : [];

    attachments.reset();
    editorRef.current?.commands.setContent("");
    setEditorHasContent(false);

    await onSubmitRef.current?.({
      kind: "message",
      text: submitText,
      files: fileParts,
      chips,
      tools: tools.values,
    });
  };

  useImperativeHandle(
    ref,
    (): ComposerHandle => ({
      focus: () => editorRef.current?.commands.focus(),
      blur: () => editorRef.current?.commands.blur(),
      clear: () => {
        editorRef.current?.commands.setContent("");
        setEditorHasContent(false);
      },
      insertText: (text) => {
        editorRef.current?.commands.insertContent(text);
      },
      insertChip: (chip) => {
        editorRef.current?.commands.insertContent({
          type: "mentionChip",
          attrs: chip,
        });
      },
      getSnapshot: () => {
        const editor = editorRef.current;
        return editor ? snapshotFromEditor(editor) : EMPTY_SNAPSHOT;
      },
      setSnapshot: (snapshot) => {
        editorRef.current?.commands.setContent(snapshot.__pmDoc as never);
      },
    }),
    [],
  );

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
    [
      attachments.items,
      attachments.add,
      attachments.remove,
      attachments.error,
      isDragging,
    ],
  );

  const commandListContextValue = useMemo(
    () => ({
      open: commandListState.isOpen,
      currentPrefix: commandListState.trigger,
      query: commandListState.query,
      selectRef: commandListSelectRef,
      navigateRef: commandListNavigateRef,
    }),
    [commandListState],
  );

  const contextValue = useMemo<ComposerContextValue>(
    () => ({
      editor: editorState,
      attachments: attachmentsState,
      tools,
      questionnaire,
      commandList: commandListContextValue,
      commands: commandsApi,
    }),
    [
      editorState,
      attachmentsState,
      tools,
      questionnaire,
      commandListContextValue,
      commandsApi,
    ],
  );

  const internalsValue = useMemo<ComposerInternalsValue>(
    () => ({
      editorRef,
      attachmentConfigRef,
      commands,
      syncCommandListState: setCommandListState,
      getRegisteredPrefixes,
      reportEditorUpdate,
    }),
    [commands, getRegisteredPrefixes, reportEditorUpdate],
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

const ComposerContainer = ({
  className,
  children,
  ...props
}: ComposerContainerProps) => {
  const { editorRef } = useComposerInternals();

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
    const editor = editorRef.current;
    if (editor && !editor.isFocused) editor.commands.focus();
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
                        <Attachments.Remove
                          onRemove={() => attachments.remove(attachment.id)}
                        />
                      </Attachments.Item>
                    ))}
                  </AnimatePresence>
                </div>
              ) : (
                <div className="h-14" />
              )}
              <Attachments.Dropzone
                visible={attachments.isDragging}
                variant="inline"
              />
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
  const { editor, attachments, questionnaire, commandList } = useComposer();
  const {
    editorRef,
    syncCommandListState,
    getRegisteredPrefixes,
    reportEditorUpdate,
  } = useComposerInternals();

  const isControlled = value !== undefined;

  const onValueChangeRef = useRef(onValueChange);
  onValueChangeRef.current = onValueChange;

  const attachmentsRef = useRef(attachments);
  attachmentsRef.current = attachments;

  const questionnaireRef = useRef(questionnaire);
  questionnaireRef.current = questionnaire;

  const commandListRef = useRef(commandList);
  commandListRef.current = commandList;

  const clearSelectionsRef = useRef(() => {});
  clearSelectionsRef.current = () => {
    const current = questionnaireRef.current;
    if (!current.questions) return;
    const currentQuestion = current.questions[current.step];
    if (!currentQuestion?.multiSelect) {
      current.clearSelections(current.step);
    }
  };

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
        class: cn(
          "max-w-none focus:outline-none w-full font-[450] leading-[1.7]",
        ),
        spellcheck: "false",
      },
      handlePaste: (_view, event) => {
        const items = event.clipboardData?.items;
        if (!items) return false;

        const files = [...items]
          .filter((item) => item.kind === "file")
          .map((item) => item.getAsFile())
          .filter((file): file is File => Boolean(file));

        if (!files.length) return false;

        event.preventDefault();
        attachmentsRef.current.add(files);
        return true;
      },
      handleKeyDown: (view, event) => {
        const cmdState = commandListPluginKey.getState(view.state);
        const action = interpretEditorKey(
          { key: event.key, shiftKey: event.shiftKey },
          {
            isCommandListOpen: cmdState?.isOpen ?? false,
            hasActiveQuestionnaire:
              (questionnaireRef.current.questions?.length ?? 0) > 0,
            isEditorEmpty: view.state.doc.textContent === "",
            hasAttachments: attachmentsRef.current.items.length > 0,
          },
        );

        if (!action) return false;

        switch (action.type) {
          case "command-select": {
            event.preventDefault();
            commandListRef.current.selectRef.current?.();
            return true;
          }
          case "command-close": {
            event.preventDefault();
            view.dispatch(
              view.state.tr.setMeta(commandListPluginKey, { close: true }),
            );
            return true;
          }
          case "command-navigate": {
            event.preventDefault();
            commandListRef.current.navigateRef.current?.(action.direction);
            return true;
          }
          case "questionnaire-arrow": {
            event.preventDefault();
            const optionsHandle = questionnaireRef.current.optionsRef.current;
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
      questionnaireRef.current.optionsRef.current?.clearHighlight();
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
        clearSelectionsRef.current();
        questionnaireRef.current.optionsRef.current?.clearHighlight();
      }
      onValueChangeRef.current?.(text);
      reportEditorUpdate(instance);
      const pluginState = commandListPluginKey.getState(instance.state);
      syncCommandListState({
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

const ComposerPlaceholder = ({
  placeholder,
  children,
  className,
}: ComposerPlaceholderProps) => {
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
      <div
        className={cn("text-ink-tertiary font-[450] leading-[1.7]", className)}
      >
        {items[0]}
      </div>
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
          className={cn(
            "text-ink-tertiary font-[450] leading-[1.7]",
            className,
          )}
        >
          {typeof items[0] === "string"
            ? currentItem
            : items[key % items.length]}
        </motion.span>
      </AnimatePresence>
    </div>
  );
};

// ---------------------------------------------------------------------------
// Composer.Actions / Composer.Submit
// ---------------------------------------------------------------------------

const ComposerActions = ({ className, ...props }: ComponentProps<"div">) => (
  <div
    data-slot="composer-actions"
    className={cn("flex justify-end gap-2 p-2", className)}
    {...props}
  />
);

type ComposerSubmitProps = ComponentProps<typeof IconButton>;

const ComposerSubmit = ({
  children,
  className,
  disabled,
  ...props
}: ComposerSubmitProps) => {
  const { editor, attachments } = useComposer();

  const autoDisabled =
    disabled ??
    ((!editor.hasContent && attachments.items.length === 0) ||
      editor.isSubmitting);

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

const ComposerPanel = ({
  children,
  className,
  value,
  ...props
}: ComposerPanelProps) => {
  const { commandList } = useComposer();
  const [contentRef, bounds] = useMeasure();

  // When a command-list prefix is active, route the panel to its
  // "command-list" item regardless of what the consumer passed.
  const effectiveValue = commandList.open ? "command-list" : value;

  const matchedChild = effectiveValue
    ? Children.toArray(children).find(
        (child) =>
          isValidElement(child) &&
          (child.props as { value?: string }).value === effectiveValue,
      )
    : null;
  const hasMatch = matchedChild != null;

  return (
    <div
      data-slot="composer-panel"
      className={cn(
        "overflow-hidden transition-transform",
        hasMatch && "pb-2",
        className,
      )}
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

type ComposerPanelItemProps = Omit<
  ComponentProps<typeof motion.div>,
  "value"
> & {
  value: string;
  children: ReactNode;
};

const ComposerPanelItem = ({
  value,
  children,
  ...props
}: ComposerPanelItemProps) => (
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

type CommandListRowHandle = { value: string };

type CommandListNavContextValue = {
  registerRow: (handle: CommandListRowHandle) => () => void;
  highlightedValue: string | null;
  setHighlightedValue: (value: string | null) => void;
  selectByValue: (value: string) => void;
};

const CommandListNavContext = createContext<CommandListNavContextValue | null>(
  null,
);

type ComposerCommandListProps<TItem extends CommandItemData> = {
  prefix: string;
  className?: string;
  children: (item: TItem) => ReactNode;
};

const ComposerCommandList = <TItem extends CommandItemData>({
  prefix,
  className,
  children: renderItem,
}: ComposerCommandListProps<TItem>): ReactNode => {
  const { commandList, tools, attachments } = useComposer();
  const { editorRef, commands } = useComposerInternals();

  const config = commands[prefix];
  const isActive = commandList.open && commandList.currentPrefix === prefix;
  const items = (config?.items ?? []) as TItem[];
  const filter = config?.filter as
    | ((item: TItem, query: string) => number)
    | null
    | undefined;
  const kind = config?.kind ?? "command";

  const filteredItems = useMemo(
    () => filterCommandItems(items, commandList.query, filter),
    [items, commandList.query, filter],
  );

  const [rows, setRows] = useState<CommandListRowHandle[]>([]);
  const [highlightedValue, setHighlightedValue] = useState<string | null>(null);

  const validHighlight =
    highlightedValue !== null &&
    rows.some((row) => row.value === highlightedValue);
  if (!validHighlight && rows.length > 0) {
    queueMicrotask(() => setHighlightedValue(rows[0].value));
  } else if (rows.length === 0 && highlightedValue !== null) {
    queueMicrotask(() => setHighlightedValue(null));
  }

  const registerRow = useCallback((handle: CommandListRowHandle) => {
    setRows((current) => [...current, handle]);
    return () => {
      setRows((current) => current.filter((entry) => entry !== handle));
    };
  }, []);

  const selectByValue = useCallback(
    (value: string) => {
      const editor = editorRef.current;
      if (!editor) return;
      const dataItem = items.find((item) => item.value === value);
      if (!dataItem) return;

      const pluginState = commandListPluginKey.getState(editor.state);
      const triggerStartPosition = pluginState?.triggerStartPosition ?? 0;
      const cursorPosition = editor.state.selection.$from.pos;

      if (kind === "chip") {
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
          editor: {
            focus: () => editor.commands.focus(),
            blur: () => editor.commands.blur(),
            clear: () => {
              editor.commands.setContent("");
            },
            insertText: (text) => {
              editor.commands.insertContent(text);
            },
            insertChip: (chip) => {
              editor.commands.insertContent({
                type: "mentionChip",
                attrs: chip,
              });
            },
          },
          tools,
          attachments: {
            add: attachments.add,
            remove: attachments.remove,
            openFileDialog: attachments.openFileDialog,
          },
        };
        dataItem.onSelect?.(onSelectContext);
      }

      editor.view.dispatch(
        editor.state.tr.setMeta(commandListPluginKey, { close: true }),
      );
    },
    [editorRef, items, kind, prefix, tools, attachments],
  );

  if (isActive) {
    commandList.selectRef.current = highlightedValue
      ? () => selectByValue(highlightedValue)
      : null;
    commandList.navigateRef.current = (direction: number) => {
      const next = computeNextHighlight(
        rows,
        highlightedValue,
        direction === -1 ? -1 : 1,
      );
      setHighlightedValue(next);
    };
  }

  const navContext = useMemo<CommandListNavContextValue>(
    () => ({
      registerRow,
      highlightedValue,
      setHighlightedValue,
      selectByValue,
    }),
    [registerRow, highlightedValue, selectByValue],
  );

  if (!isActive) return null;

  if (filteredItems.length === 0) {
    return (
      <Commands className={className}>
        <Commands.Empty>No results</Commands.Empty>
      </Commands>
    );
  }

  return (
    <CommandListNavContext.Provider value={navContext}>
      <Commands className={className}>
        {filteredItems.map((item, index) => (
          <Fragment key={item.value ?? `__cmd_${index}`}>
            {renderItem(item)}
          </Fragment>
        ))}
      </Commands>
    </CommandListNavContext.Provider>
  );
};

type ComposerCommandItemProps = {
  value: string;
  children?: ReactNode;
};

const ComposerCommandItem = ({ value, children }: ComposerCommandItemProps) => {
  const navContext = useContext(CommandListNavContext);
  if (!navContext) {
    throw new Error(
      "<Composer.CommandItem> must be rendered inside <Composer.CommandList>.",
    );
  }

  useEffect(() => {
    return navContext.registerRow({ value });
  }, [navContext, value]);

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

const ComposerCommandItemIcon = ({
  children,
  className,
  ...props
}: ComponentProps<"span">) => (
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

const ComposerCommandItemLabel = ({
  className,
  ...props
}: ComponentProps<"span">) => (
  <span
    data-slot="composer-command-item-label"
    className={cn("text-sm", className)}
    {...props}
  />
);

const ComposerCommandItemDescription = ({
  className,
  ...props
}: ComponentProps<"span">) => (
  <span
    data-slot="composer-command-item-description"
    className={cn("text-xs text-ink-tertiary truncate", className)}
    {...props}
  />
);

const ComposerCommandGroup = ({
  className,
  children,
  ...props
}: ComponentProps<"div">) => (
  <Commands.Group className={className} {...props}>
    {children}
  </Commands.Group>
);

const ComposerCommandGroupLabel = ({
  className,
  children,
  ...props
}: ComponentProps<"div">) => (
  <div
    data-slot="composer-command-group-label"
    className={cn(
      "px-2 pt-2 pb-1 text-xs font-medium text-ink-tertiary",
      className,
    )}
    {...props}
  >
    {children}
  </div>
);

type ComposerCommandCollectionProps<TItem> = {
  items: TItem[];
  children: (item: TItem) => ReactNode;
};

const ComposerCommandCollection = <TItem,>({
  items,
  children: renderItem,
}: ComposerCommandCollectionProps<TItem>): ReactNode => (
  <>
    {items.map((item, index) => (
      <Fragment
        key={(item as { value?: string } | null)?.value ?? `__col_${index}`}
      >
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
          {(item) => (
            <ComposerCommandItem value={item.value}>
              {item.icon && (
                <ComposerCommandItemIcon>{item.icon}</ComposerCommandItemIcon>
              )}
              <ComposerCommandItemLabel>{item.label}</ComposerCommandItemLabel>
              {item.description && (
                <ComposerCommandItemDescription>
                  {item.description}
                </ComposerCommandItemDescription>
              )}
            </ComposerCommandItem>
          )}
        </ComposerCommandList>
      ))}
    </>
  );
};

// ---------------------------------------------------------------------------
// Composer.Questions (with sub-Parts) — default render for the questionnaire
// registered via the `questions` prop on Composer Root.
// ---------------------------------------------------------------------------

const ComposerQuestionsRoot = () => {
  const { questionnaire } = useComposer();

  const question = questionnaire.questions?.[questionnaire.step] ?? null;
  const lastQuestionRef = useRef(question);
  if (question) lastQuestionRef.current = question;
  const display = question ?? lastQuestionRef.current;

  if (!display) return null;

  const entry = questionnaire.answers.get(questionnaire.step) ?? {
    selected: new Set<string>(),
    freeText: "",
  };

  const totalQuestions = questionnaire.questions?.length ?? 0;

  return (
    <Questionnaire>
      <Questionnaire.Header>
        <Questionnaire.Label>{display.question}</Questionnaire.Label>
        {!questionnaire.isSingle && totalQuestions > 1 && (
          <Questionnaire.Navigation>
            <Questionnaire.Previous
              onClick={questionnaire.goBack}
              disabled={questionnaire.step === 0}
            />
            <Questionnaire.StepLabel
              current={questionnaire.step + 1}
              total={totalQuestions}
            />
            <Questionnaire.Next
              onClick={questionnaire.goNext}
              disabled={questionnaire.step === totalQuestions - 1}
            />
          </Questionnaire.Navigation>
        )}
      </Questionnaire.Header>
      {display.options && (
        <Questionnaire.Options
          ref={questionnaire.optionsRef}
          multiSelect={!!display.multiSelect}
          groupName={`q-${questionnaire.step}`}
          value={[...entry.selected][0] ?? ""}
          onValueChange={(value) =>
            questionnaire.toggleOption(questionnaire.step, value, false)
          }
        >
          {display.options.map((option) => (
            <Questionnaire.Option
              key={option.label}
              value={option.label}
              selected={entry.selected.has(option.label)}
              onSelect={() =>
                questionnaire.toggleOption(
                  questionnaire.step,
                  option.label,
                  !!display.multiSelect,
                )
              }
            >
              <Questionnaire.OptionInput />
              <Questionnaire.OptionContent>
                <Questionnaire.OptionLabel>
                  {option.label}
                </Questionnaire.OptionLabel>
                {option.description && (
                  <Questionnaire.OptionDescription>
                    {option.description}
                  </Questionnaire.OptionDescription>
                )}
              </Questionnaire.OptionContent>
            </Questionnaire.Option>
          ))}
        </Questionnaire.Options>
      )}
    </Questionnaire>
  );
};

const ComposerQuestionsHints = ({
  className,
  ...props
}: ComponentProps<typeof Questionnaire.Hints>) => {
  const { questionnaire } = useComposer();
  const totalQuestions = questionnaire.questions?.length ?? 0;

  return (
    <Questionnaire.Hints className={cn("flex-1", className)} {...props}>
      <span className="inline-flex items-center gap-1">
        <Kbd size="sm">↑</Kbd>
        <Kbd size="sm">↓</Kbd> navigate
      </span>
      <span className="inline-flex items-center gap-1">
        <Kbd size="sm">↵</Kbd> select
      </span>
      {!questionnaire.isSingle && totalQuestions > 1 && (
        <span className="inline-flex items-center gap-1">
          <Kbd size="sm">←</Kbd>
          <Kbd size="sm">→</Kbd> between questions
        </span>
      )}
      <span className="inline-flex items-center gap-1">
        <Kbd size="sm">esc</Kbd> skip
      </span>
    </Questionnaire.Hints>
  );
};

type ComposerQuestionsDismissProps = ComponentProps<typeof Button>;

const ComposerQuestionsDismiss = ({
  className,
  ...props
}: ComposerQuestionsDismissProps) => {
  const { questionnaire } = useComposer();
  return (
    <Button
      type="button"
      variant="ghost"
      data-slot="composer-questions-dismiss"
      className={cn("gap-2", className)}
      onClick={questionnaire.dismissStep}
      {...props}
    >
      Dismiss
      <Kbd size="sm">ESC</Kbd>
    </Button>
  );
};

type ComposerQuestionsContinueProps = ComponentProps<typeof Button>;

const ComposerQuestionsContinue = ({
  className,
  ...props
}: ComposerQuestionsContinueProps) => {
  const { questionnaire } = useComposer();
  return (
    <Button
      type="submit"
      variant="tertiary"
      data-slot="composer-questions-continue"
      className={cn("gap-2", className)}
      {...props}
    >
      {questionnaire.isLastStep ? "Submit" : "Continue"}
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
  Actions: ComposerActions,
  Placeholder: ComposerPlaceholder,
  Submit: ComposerSubmit,
  Panel: ComposerPanel,
  PanelItem: ComposerPanelItem,
  Textarea: ComposerTextarea,
  Questions: ComposerQuestionsRoot,
  Hints: ComposerQuestionsHints,
  Dismiss: ComposerQuestionsDismiss,
  Continue: ComposerQuestionsContinue,
  Commands: ComposerCommands,
  CommandList: ComposerCommandList,
  CommandItem: ComposerCommandItem,
  CommandItemIcon: ComposerCommandItemIcon,
  CommandItemLabel: ComposerCommandItemLabel,
  CommandItemDescription: ComposerCommandItemDescription,
  CommandGroup: ComposerCommandGroup,
  CommandGroupLabel: ComposerCommandGroupLabel,
  CommandCollection: ComposerCommandCollection,
});
