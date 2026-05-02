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
import React, {
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
// Prefix configuration types
// ---------------------------------------------------------------------------

export type PrefixKind = "chip" | "command";

export type TriggerRule = "doc-start" | "after-whitespace";

export type PrefixOnSelectContext = {
  editor: Editor;
  tools: ComposerToolsValue;
  attachments: ComposerAttachmentsValue;
};

/**
 * Minimum shape an item must satisfy if you want the default filter to work.
 * Custom shapes are fine — pass a `filter` on the prefix config to override.
 */
export type CommandItemData = {
  value: string;
  label?: string;
  keywords?: string;
  /**
   * Icon JSX. Rendered both in the dropdown row (when the consumer's render
   * function passes it through) and inside the inserted chip (composer reads
   * it via the `commands` prop using the chip's `prefix` + `value`).
   */
  icon?: ReactNode;
  onSelect?: (ctx: PrefixOnSelectContext) => void;
};

export type CommandPrefixConfig<TItem = CommandItemData> = {
  kind: PrefixKind;
  triggerRule: TriggerRule;
  items: TItem[];
  /**
   * Custom filter — receives the item and the current query, returns a score
   * (0 means no match). Default: fuzzy-match against `item.label` (with
   * `item.keywords` mixed in). Pass `null` to disable filtering.
   */
  filter?: ((item: TItem, query: string) => number) | null;
};

// Erased generic for storing in context / passing through the plugin.
type AnyCommandPrefixConfig = CommandPrefixConfig<unknown>;
type CommandsConfig = Record<string, AnyCommandPrefixConfig>;

type CommandListState = {
  isOpen: boolean;
  trigger: string | null;
  query: string;
  triggerStartPosition: number;
};

const CLOSED_COMMAND_STATE: CommandListState = {
  isOpen: false,
  trigger: null,
  query: "",
  triggerStartPosition: 0,
};

// ---------------------------------------------------------------------------
// Fuzzy scoring & filtering
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
  const fn = filter ?? (defaultItemFilter as (i: TItem, q: string) => number);
  return items
    .map((item) => ({ item, score: fn(item, query) }))
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score)
    .map(({ item }) => item);
};

// ---------------------------------------------------------------------------
// ProseMirror Plugin — trigger detection driven by registered prefixes
// ---------------------------------------------------------------------------

const commandListPluginKey = new PluginKey<CommandListState>("commandList");

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
  const cursorPos = state.selection.$from.pos;
  const classes = pluginState.query
    ? BADGE_CLASSES
    : `${BADGE_CLASSES} ${PLACEHOLDER_CLASSES}`;

  const inline = Decoration.inline(triggerStart, cursorPos, {
    class: classes,
  });
  return DecorationSet.create(state.doc, [inline]);
};

const escapeRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const createCommandListPlugin = (getCommands: () => CommandsConfig) =>
  new Plugin<CommandListState>({
    key: commandListPluginKey,
    state: {
      init: () => CLOSED_COMMAND_STATE,
      apply(transaction, previousState, _oldEditorState, newEditorState) {
        const meta = transaction.getMeta(commandListPluginKey);
        if (meta?.close) return CLOSED_COMMAND_STATE;

        if (!transaction.docChanged && !transaction.selectionSet) {
          return previousState;
        }

        const commands = getCommands();
        const prefixKeys = Object.keys(commands);
        if (prefixKeys.length === 0) return CLOSED_COMMAND_STATE;

        const { selection } = newEditorState;
        const cursorPosition = selection.$from.pos;
        const blockStart = selection.$from.start();
        const textBeforeCursor = newEditorState.doc.textBetween(
          blockStart,
          cursorPosition,
          "\n",
        );
        const fullDocText = newEditorState.doc.textContent;

        for (const prefix of prefixKeys) {
          const config = commands[prefix];
          if (config.triggerRule === "doc-start") {
            if (fullDocText.startsWith(prefix)) {
              return {
                isOpen: true,
                trigger: prefix,
                query: fullDocText.slice(prefix.length),
                triggerStartPosition: blockStart,
              };
            }
            continue;
          }

          // after-whitespace
          const escaped = escapeRegex(prefix);
          const pattern = new RegExp(`(^|[\\s])${escaped}([^\\s]*)$`);
          const match = textBeforeCursor.match(pattern);
          if (match) {
            const query = match[2];
            const triggerStartPosition =
              cursorPosition - query.length - prefix.length;
            return {
              isOpen: true,
              trigger: prefix,
              query,
              triggerStartPosition,
            };
          }
        }

        return CLOSED_COMMAND_STATE;
      },
    },
    props: {
      decorations: commandFilterDecorations,
    },
  });

// ---------------------------------------------------------------------------
// MentionChip — TipTap Node extension for inline chips
//
// Chip attrs are serialized strings (prefix, label, value). The chip view
// looks up the source item from the `commands` prop using prefix + value to
// recover its `icon` JSX. No registry or HTML serialization — the icon comes
// from the same data array the dropdown rendered from.
// ---------------------------------------------------------------------------

const MentionChipNodeView = ({
  node,
}: {
  node: { attrs: Record<string, unknown> };
}) => {
  const { commands } = useComposer();
  const prefix = node.attrs.prefix as string;
  const value = node.attrs.value as string;
  const label = node.attrs.label as string;

  const item = commands[prefix]?.items.find(
    (i) => (i as { value?: string } | null)?.value === value,
  ) as { icon?: ReactNode } | undefined;
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

/**
 * Walks the editor doc for chip nodes and returns each chip's `prefix`,
 * `value`, and `label` in document order. Used to surface structured chip
 * data on the message submit payload.
 */
const extractChips = (
  editor: Editor,
): Array<{ prefix: string; value: string; label: string }> => {
  const out: Array<{ prefix: string; value: string; label: string }> = [];
  editor.state.doc.descendants((node) => {
    if (node.type.name !== "mentionChip") return;
    const { prefix, value, label } = node.attrs as {
      prefix?: string;
      value?: string;
      label?: string;
    };
    out.push({
      prefix: prefix ?? "",
      value: value ?? "",
      label: label ?? "",
    });
  });
  return out;
};

const createMentionChipExtension = (getCommands: () => CommandsConfig) =>
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
          "inline-flex items-center gap-0.5 h-6 rounded-sm bg-primary-hover px-0.75 font-medium leading-[normal] text-ink-primary align-[-1px] select-none [text-box:trim-both_cap_alphabetic]",
      });
    },

    addProseMirrorPlugins() {
      return [createCommandListPlugin(getCommands)];
    },
  });

// ---------------------------------------------------------------------------
// Composer
// ---------------------------------------------------------------------------

type AnswerEntry = { selected: Set<string>; freeText: string };


type ComposerEditorValue = {
  ref: RefObject<Editor | null>;
  hasContent: boolean;
  setHasContent: (has: boolean) => void;
  isSubmitting: boolean;
};

type ComposerAttachmentsValue = {
  items: AttachmentItem[];
  add: (files: File[] | FileList) => void;
  remove: (id: string) => void;
  openFileDialog: () => void;
  error: string | null;
  isDragging: boolean;
  fileInputRef: RefObject<HTMLInputElement | null>;
  globalDropRef: RefObject<boolean>;
};

type ComposerToolsValue = {
  webSearch: boolean;
  setWebSearch: (value: boolean) => void;
  thinking: boolean;
  setThinking: (value: boolean) => void;
};

type ComposerQuestionnaireValue = {
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

type ComposerCommandListValue = {
  open: boolean;
  currentPrefix: string | null;
  query: string;
  selectRef: RefObject<(() => void) | null>;
  navigateRef: RefObject<((direction: number) => void) | null>;
};

type ComposerContextValue = {
  editor: ComposerEditorValue;
  attachments: ComposerAttachmentsValue;
  tools: ComposerToolsValue;
  questionnaire: ComposerQuestionnaireValue;
  commandList: ComposerCommandListValue;
  /** Live `commands` prop value, exposed for <Composer.CommandList>. */
  commands: CommandsConfig;
};

const ComposerContext = createContext<ComposerContextValue>({
  editor: {
    ref: { current: null },
    hasContent: false,
    setHasContent: () => {},
    isSubmitting: false,
  },
  attachments: {
    items: [],
    add: () => {},
    remove: () => {},
    openFileDialog: () => {},
    error: null,
    isDragging: false,
    fileInputRef: { current: null },
    globalDropRef: { current: false },
  },
  tools: {
    webSearch: false,
    setWebSearch: () => {},
    thinking: false,
    setThinking: () => {},
  },
  questionnaire: {
    questions: null,
    step: 0,
    answers: new Map(),
    toggleOption: () => {},
    continueStep: () => {},
    dismissStep: () => {},
    isLastStep: false,
    isSingle: false,
    clearSelections: () => {},
    goBack: () => {},
    goNext: () => {},
    optionsRef: { current: null },
  },
  commandList: {
    open: false,
    currentPrefix: null,
    query: "",
    selectRef: { current: null },
    navigateRef: { current: null },
  },
  commands: {},
});

export const useComposer = () => useContext(ComposerContext);

// Internal context — setters/handles only the composer's own children
// (textarea, command list) need. Not part of the public API.
type ComposerInternalsValue = {
  syncCommandListState: (state: {
    isOpen: boolean;
    trigger: string | null;
    query: string;
  }) => void;
  /** Stable getter for the latest `commands` prop, used by the trigger plugin. */
  getCommands: () => CommandsConfig;
};

const ComposerInternals = createContext<ComposerInternalsValue>({
  syncCommandListState: () => {},
  getCommands: () => ({}),
});

const useComposerInternals = () => useContext(ComposerInternals);

// Drag handler factory — always on document, scope-checked at event time
const createDragHandlers = (
  addRef: RefObject<((files: File[] | FileList) => void) | null>,
  counter: { current: number },
  setDragging: (v: boolean) => void,
  isInScope: (e: DragEvent) => boolean,
) => ({
  onDragOver: (e: Event) => {
    if (!addRef.current) return;
    const event = e as DragEvent;
    if (!isInScope(event)) return;
    if (event.dataTransfer?.types?.includes("Files")) event.preventDefault();
  },
  onDragEnter: (e: Event) => {
    if (!addRef.current) return;
    const event = e as DragEvent;
    if (!isInScope(event)) return;
    if (event.dataTransfer?.types?.includes("Files")) {
      counter.current++;
      setDragging(true);
    }
  },
  onDragLeave: (e: Event) => {
    if (!addRef.current) return;
    const event = e as DragEvent;
    if (!isInScope(event)) return;
    counter.current--;
    if (counter.current === 0) setDragging(false);
  },
  onDrop: (e: Event) => {
    if (!addRef.current) return;
    const event = e as DragEvent;
    if (!isInScope(event)) return;
    if (event.dataTransfer?.types?.includes("Files")) event.preventDefault();
    counter.current = 0;
    setDragging(false);
    if (event.dataTransfer?.files && event.dataTransfer.files.length > 0) {
      addRef.current(event.dataTransfer.files);
    }
  },
});

// Submitted data variants — discriminated by `kind`. The composer fires a
// single `onSubmit` for both message sends and questionnaire answers; the
// shape depends on which mode the form was in when the user pressed enter.

export type ComposerMessageSubmit = {
  kind: "message";
  text: string;
  files: FileUIPart[];
  /** Chips inserted via chip-kind prefixes, in document order. Each entry
   * carries the prefix that produced it so consumers can disambiguate when
   * multiple chip prefixes are configured (e.g. `@` and `#`). */
  chips: Array<{ prefix: string; value: string; label: string }>;
  /** Active tool toggles. Forward-compat: typed as a flat record so adding a
   * new tool doesn't widen the union. */
  tools: Record<string, boolean>;
};

export type ComposerAnswersSubmit = {
  kind: "answers";
  answers: Record<string, string>;
};

export type ComposerSubmitData = ComposerMessageSubmit | ComposerAnswersSubmit;

// Root — renders <form>, owns submit lifecycle
type ComposerRootProps = Omit<ComponentProps<"form">, "onSubmit"> & {
  onSubmit?: (data: ComposerSubmitData) => void | Promise<void>;
  isSubmitting?: boolean;
  questions?: AskUserQuestion[];
  attachmentAccept?: string;
  attachmentMaxFiles?: number;
  attachmentMaxFileSize?: number;
  /**
   * Configuration for command-list prefixes. Map of prefix character to its
   * config (kind, triggerRule, items, optional filter). When the user types a
   * prefix that matches one of these keys (per its triggerRule), the matching
   * <Composer.CommandList prefix="..."> renders.
   */
  commands?: CommandsConfig;
};

const EMPTY_COMMANDS: CommandsConfig = {};

const ComposerRoot = ({
  children,
  className,
  onSubmit,
  isSubmitting = false,
  questions,
  attachmentAccept: accept = DEFAULT_ATTACHMENT_ACCEPT,
  attachmentMaxFiles: maxFiles = DEFAULT_ATTACHMENT_MAX_FILES,
  attachmentMaxFileSize: maxFileSize = DEFAULT_ATTACHMENT_MAX_FILE_SIZE,
  commands = EMPTY_COMMANDS,
  ...formProps
}: ComposerRootProps) => {
  const editorRef = useRef<Editor | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const rootRef = useRef<HTMLFormElement | null>(null);
  const globalDropRef = useRef(false);
  const dragCounter = useRef(0);
  const commandListSelectRef = useRef<(() => void) | null>(null);
  const commandListNavigateRef = useRef<((direction: number) => void) | null>(
    null,
  );
  const questionnaireOptionsRef = useRef<QuestionnaireOptionsHandle | null>(
    null,
  );

  const [isDragging, setIsDragging] = useState(false);
  const [editorHasContent, setEditorHasContent] = useState(false);
  const [attachmentItems, setAttachmentItems] = useState<AttachmentItem[]>([]);
  const attachmentRef = useRef<AttachmentItem[]>(attachmentItems);
  const [attachmentError, setAttachmentError] = useState<string | null>(null);
  const [webSearch, setWebSearch] = useState(false);
  const [thinking, setThinking] = useState(false);

  // Mirrors the ProseMirror plugin's command-list state so React subtrees
  // (e.g. <Composer.States>) can react to opens/closes. The textarea syncs
  // this from plugin state on every editor update.
  const [commandListState, setCommandListState] = useState<{
    isOpen: boolean;
    trigger: string | null;
    query: string;
  }>({ isOpen: false, trigger: null, query: "" });

  // Live ref to the latest `commands` prop so the ProseMirror plugin (which
  // captures a getter at editor-creation time) sees current configs.
  const commandsRef = useRef(commands);
  commandsRef.current = commands;
  const getCommands = useCallback(() => commandsRef.current, []);

  attachmentRef.current = attachmentItems;

  // Attachment operations — lifted here so they're available on context directly
  const addAttachments = useCallback(
    (fileList: File[] | FileList) => {
      const incoming = [...fileList];
      if (!incoming.length) return;

      const accepted = incoming.filter((f) => matchesAccept(f, accept));
      if (incoming.length > 0 && !accepted.length) {
        setAttachmentError("No files match the accepted types.");
        return;
      }

      const sized = accepted.filter((f) => f.size <= maxFileSize);
      if (accepted.length > 0 && !sized.length) {
        setAttachmentError("All files exceed the maximum size.");
        return;
      }

      const capacity = Math.max(0, maxFiles - attachmentRef.current.length);
      const capped = sized.slice(0, capacity);

      if (sized.length > capacity) {
        setAttachmentError("Too many files. Some were not added.");
      }

      if (!capped.length) return;

      setAttachmentError(null);
      setAttachmentItems((prev) => [...prev, ...capped.map(toAttachmentItem)]);
    },
    [accept, maxFiles, maxFileSize],
  );

  const removeAttachment = useCallback((id: string) => {
    const found = attachmentRef.current.find((item) => item.id === id);
    if (found) revokeAttachmentUrl(found);
    setAttachmentItems((prev) => prev.filter((item) => item.id !== id));
    setAttachmentError(null);
  }, []);

  const openFileDialog = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  // Stable ref for drag handlers (avoids re-registering document listeners)
  const addRef = useRef(addAttachments);
  addRef.current = addAttachments;

  // Questionnaire state — reset when questions identity changes
  const previousQuestionsRef = useRef(questions);
  const [questionnaireStep, setQuestionnaireStep] = useState(0);
  const [questionnaireAnswers, setQuestionnaireAnswers] = useState<
    Map<number, AnswerEntry>
  >(() => new Map());
  if (previousQuestionsRef.current !== questions) {
    previousQuestionsRef.current = questions;
    setQuestionnaireStep(0);
    setQuestionnaireAnswers(new Map());
    // Blur editor when questionnaire appears — first option will be highlighted
    if (questions?.length) {
      editorRef.current?.commands.blur();
    }
  }
  const answersRef = useRef(questionnaireAnswers);
  answersRef.current = questionnaireAnswers;

  const isLastQuestionStep = questions
    ? questionnaireStep >= questions.length - 1
    : false;
  const isSingleQuestion = questions ? questions.length === 1 : false;

  const toggleQuestionOption = useCallback(
    (step: number, label: string, multiSelect: boolean) => {
      setQuestionnaireAnswers((prev) => {
        const next = new Map(prev);
        const entry = next.get(step) ?? {
          selected: new Set<string>(),
          freeText: "",
        };
        const newSelected = new Set(entry.selected);
        if (multiSelect) {
          if (newSelected.has(label)) newSelected.delete(label);
          else newSelected.add(label);
        } else {
          newSelected.clear();
          newSelected.add(label);
        }
        next.set(step, {
          selected: newSelected,
          freeText: multiSelect ? entry.freeText : "",
        });
        return next;
      });
      if (!multiSelect) {
        editorRef.current?.commands.setContent("");
        setEditorHasContent(false);
      }
    },
    [],
  );

  const clearQuestionSelections = useCallback((step: number) => {
    setQuestionnaireAnswers((prev) => {
      const entry = prev.get(step);
      if (!entry || entry.selected.size === 0) return prev;
      const next = new Map(prev);
      next.set(step, { selected: new Set(), freeText: entry.freeText });
      return next;
    });
  }, []);

  const compileAnswers = useCallback(
    (answers: Map<number, AnswerEntry>) => {
      if (!questions) return {};
      const result: Record<string, string> = {};
      for (let i = 0; i < questions.length; i++) {
        const entry = answers.get(i);
        result[questions[i].question] = !entry
          ? ""
          : entry.selected.size > 0
            ? [...entry.selected].join(", ")
            : entry.freeText.trim();
      }
      return result;
    },
    [questions],
  );

  const continueStep = useCallback(
    (freeText?: string) => {
      if (!questions?.length) return;
      const text = freeText?.trim() ?? "";
      let updatedAnswers = answersRef.current;

      if (text) {
        const q = questions[questionnaireStep];
        const entry = updatedAnswers.get(questionnaireStep) ?? {
          selected: new Set<string>(),
          freeText: "",
        };
        updatedAnswers = new Map(updatedAnswers);
        updatedAnswers.set(questionnaireStep, {
          selected: q?.multiSelect ? entry.selected : new Set(),
          freeText: text,
        });
        setQuestionnaireAnswers(updatedAnswers);
      }

      editorRef.current?.commands.setContent("");
      setEditorHasContent(false);

      if (questionnaireStep < questions.length - 1) {
        setQuestionnaireStep((s) => s + 1);
        questionnaireOptionsRef.current?.resetHighlight();
        editorRef.current?.commands.blur();
      } else {
        onSubmit?.({
        kind: "answers",
        answers: compileAnswers(updatedAnswers),
      });
        editorRef.current?.commands.focus();
      }
    },
    [questions, questionnaireStep, onSubmit, compileAnswers],
  );

  const dismissStep = useCallback(() => {
    if (!questions?.length) return;

    editorRef.current?.commands.setContent("");
    setEditorHasContent(false);

    const updatedAnswers = new Map(answersRef.current);
    updatedAnswers.delete(questionnaireStep);
    setQuestionnaireAnswers(updatedAnswers);

    if (questionnaireStep < questions.length - 1) {
      setQuestionnaireStep((s) => s + 1);
      questionnaireOptionsRef.current?.resetHighlight();
      editorRef.current?.commands.blur();
    } else {
      onSubmit?.({
        kind: "answers",
        answers: compileAnswers(updatedAnswers),
      });
      editorRef.current?.commands.focus();
    }
  }, [questions, questionnaireStep, onSubmit, compileAnswers]);

  /** Save current editor text as freeText for the given step, then load the target step's freeText. */
  const transitionStep = useCallback(
    (targetStep: number) => {
      // No-op if caller clamped to the current step (e.g. Right arrow on the
      // last question, or any arrow with only one question). Otherwise
      // resetHighlight clears the highlight without any item remount to
      // re-trigger the auto-highlight path.
      if (targetStep === questionnaireStep) return;
      const currentText = editorRef.current?.getText()?.trim() ?? "";
      // Save freeText for the step we're leaving
      if (currentText) {
        setQuestionnaireAnswers((prev) => {
          const next = new Map(prev);
          const entry = next.get(questionnaireStep) ?? {
            selected: new Set<string>(),
            freeText: "",
          };
          next.set(questionnaireStep, { ...entry, freeText: currentText });
          return next;
        });
      }
      // Load freeText for the target step
      const targetEntry = answersRef.current.get(targetStep);
      const targetFreeText = targetEntry?.freeText ?? "";
      editorRef.current?.commands.setContent(targetFreeText);
      setEditorHasContent(targetFreeText.length > 0);

      setQuestionnaireStep(targetStep);
      questionnaireOptionsRef.current?.resetHighlight();
      editorRef.current?.commands.blur();
    },
    [questionnaireStep],
  );

  const goBackStep = useCallback(() => {
    transitionStep(Math.max(0, questionnaireStep - 1));
  }, [transitionStep, questionnaireStep]);

  const goNextStep = useCallback(() => {
    if (!questions) return;
    transitionStep(Math.min(questions.length - 1, questionnaireStep + 1));
  }, [transitionStep, questionnaireStep, questions]);

  const handleFormSubmit = async (e: React.SubmitEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (questions?.length) {
      const text = editorRef.current?.getText()?.trim() ?? "";
      editorRef.current?.commands.setContent("");
      setEditorHasContent(false);
      continueStep(text);
      return;
    }

    if (isSubmitting) return;

    const text = editorRef.current?.getText()?.trim() ?? "";
    if (!text && !attachmentItems.length) return;

    const submitText = text || "Sent with attachments";
    const files =
      attachmentItems.length > 0
        ? await prepareAttachmentsForSend(attachmentItems)
        : [];

    const chips = editorRef.current
      ? extractChips(editorRef.current)
      : [];

    revokeAllAttachmentUrls(attachmentItems);
    setAttachmentItems([]);
    editorRef.current?.commands.setContent("");
    setEditorHasContent(false);

    await onSubmit?.({
      kind: "message",
      text: submitText,
      files,
      chips,
      tools: { webSearch, thinking },
    });
  };

  // Drag handlers — always on document, scope-checked at event time via refs
  useEffect(() => {
    const isInScope = (e: DragEvent) =>
      globalDropRef.current ||
      (rootRef.current?.contains(e.target as Node) ?? false);

    const { onDragOver, onDragEnter, onDragLeave, onDrop } = createDragHandlers(
      addRef,
      dragCounter,
      setIsDragging,
      isInScope,
    );

    document.addEventListener("dragover", onDragOver);
    document.addEventListener("dragenter", onDragEnter);
    document.addEventListener("dragleave", onDragLeave);
    document.addEventListener("drop", onDrop);
    return () => {
      document.removeEventListener("dragover", onDragOver);
      document.removeEventListener("dragenter", onDragEnter);
      document.removeEventListener("dragleave", onDragLeave);
      document.removeEventListener("drop", onDrop);
    };
  }, []);

  // Questionnaire keyboard handler — document-level because editor is blurred when highlight is active.
  // Refs avoid re-subscribing when callbacks change.
  const dismissStepRef = useRef(dismissStep);
  dismissStepRef.current = dismissStep;
  const continueStepRef = useRef(continueStep);
  continueStepRef.current = continueStep;
  const toggleOptionRef = useRef(toggleQuestionOption);
  toggleOptionRef.current = toggleQuestionOption;
  const goBackStepRef = useRef(goBackStep);
  goBackStepRef.current = goBackStep;
  const goNextStepRef = useRef(goNextStep);
  goNextStepRef.current = goNextStep;
  const questionnaireStepRef = useRef(questionnaireStep);
  questionnaireStepRef.current = questionnaireStep;
  const questionsRef = useRef(questions);
  questionsRef.current = questions;

  useEffect(() => {
    if (!questions?.length) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.defaultPrevented) return;
      const optionsHandle = questionnaireOptionsRef.current;
      const isHighlighted = optionsHandle?.highlightedValue != null;

      // ESC always dismisses (whether highlight active or textarea focused)
      if (e.key === "Escape") {
        e.preventDefault();
        dismissStepRef.current();
        return;
      }

      // Remaining keys only apply when an option is highlighted (editor blurred)
      if (!isHighlighted) return;

      if (e.key === "ArrowUp" || e.key === "ArrowDown") {
        e.preventDefault();
        const direction = e.key === "ArrowUp" ? -1 : 1;
        const newValue = optionsHandle.navigate(direction);
        if (newValue === null) {
          // Past the list → focus editor
          editorRef.current?.commands.focus();
        }
        return;
      }

      if (e.key === "Enter") {
        e.preventDefault();
        const item = optionsHandle.select();
        if (!item) return;
        const currentQuestion =
          questionsRef.current?.[questionnaireStepRef.current];
        if (currentQuestion?.multiSelect) {
          toggleOptionRef.current(
            questionnaireStepRef.current,
            item.value,
            true,
          );
        } else {
          toggleOptionRef.current(
            questionnaireStepRef.current,
            item.value,
            false,
          );
          continueStepRef.current();
        }
        return;
      }

      if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
        e.preventDefault();
        if (e.key === "ArrowLeft") goBackStepRef.current();
        else goNextStepRef.current();
        return;
      }

      // Printable character → focus editor, clear highlight, insert character
      if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
        e.preventDefault();
        optionsHandle.clearHighlight();
        const editorInstance = editorRef.current;
        editorInstance?.commands.focus();
        editorInstance?.commands.insertContent(e.key);
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [questions]);

  const contextValue = useMemo(
    () => ({
      editor: {
        ref: editorRef,
        hasContent: editorHasContent,
        setHasContent: setEditorHasContent,
        isSubmitting,
      },
      attachments: {
        items: attachmentItems,
        add: addAttachments,
        remove: removeAttachment,
        openFileDialog,
        error: attachmentError,
        isDragging,
        fileInputRef,
        globalDropRef,
      },
      tools: {
        webSearch,
        setWebSearch,
        thinking,
        setThinking,
      },
      questionnaire: {
        questions: questions ?? null,
        step: questionnaireStep,
        answers: questionnaireAnswers,
        toggleOption: toggleQuestionOption,
        continueStep,
        dismissStep,
        isLastStep: isLastQuestionStep,
        isSingle: isSingleQuestion,
        clearSelections: clearQuestionSelections,
        goBack: goBackStep,
        goNext: goNextStep,
        optionsRef: questionnaireOptionsRef,
      },
      commandList: {
        open: commandListState.isOpen,
        currentPrefix: commandListState.trigger,
        query: commandListState.query,
        selectRef: commandListSelectRef,
        navigateRef: commandListNavigateRef,
      },
      commands,
    }),
    [
      isDragging,
      isSubmitting,
      editorHasContent,
      attachmentItems,
      addAttachments,
      removeAttachment,
      openFileDialog,
      attachmentError,
      webSearch,
      thinking,
      questions,
      questionnaireStep,
      questionnaireAnswers,
      toggleQuestionOption,
      continueStep,
      dismissStep,
      isLastQuestionStep,
      isSingleQuestion,
      clearQuestionSelections,
      goBackStep,
      goNextStep,
      commandListState,
      commands,
    ],
  );

  const internalsValue = useMemo<ComposerInternalsValue>(
    () => ({
      syncCommandListState: setCommandListState,
      getCommands,
    }),
    [getCommands],
  );

  return (
    <ComposerContext.Provider value={contextValue}>
      <ComposerInternals.Provider value={internalsValue}>
        <form
          onSubmit={handleFormSubmit}
          ref={rootRef}
          className={cn("relative w-full flex flex-col", className)}
          {...formProps}
        >
          {children}
        </form>
      </ComposerInternals.Provider>
    </ComposerContext.Provider>
  );
};

// Container — visual container with border/bg/rounded, click-to-focus
type ComposerContainerProps = ComponentProps<"div">;

const ComposerContainer = ({
  className,
  children,
  ...props
}: ComposerContainerProps) => {
  const { editor } = useComposer();

  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement;
    if (
      target.tagName === "BUTTON" ||
      target.tagName === "A" ||
      target.tagName === "INPUT" ||
      target.closest("button, a, input")
    )
      return;

    e.preventDefault();
    const editorInstance = editor.ref.current;
    if (editorInstance && !editorInstance.isFocused) {
      editorInstance.commands.focus();
    }
  };

  return (
    <div
      role="button"
      tabIndex={0}
      data-slot="composer-container"
      onMouseDown={handleMouseDown}
      className={cn(
        "border border-primary-border bg-primary rounded-4xl shadow-xs [corner-shape:squircle] cursor-text",
        "transition-colors",
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
};

// Attachments — renders file input + attachment list, reads operations from context
type ComposerAttachmentsProps = {
  className?: string;
  accept?: string;
  multiple?: boolean;
  globalDrop?: boolean;
};

const ComposerAttachments = ({
  className,
  accept = DEFAULT_ATTACHMENT_ACCEPT,
  multiple = true,
  globalDrop = false,
}: ComposerAttachmentsProps) => {
  const { attachments } = useComposer();

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

      {/* Attachments container with dropzone overlay */}
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

// Textarea — TipTap editor, pushes hasContent into context

type ComposerTextareaProps = {
  value?: string;
  onValueChange?: (content: string) => void;
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
  const { syncCommandListState, getCommands } = useComposerInternals();

  const mentionExtension = useMemo(
    () => createMentionChipExtension(getCommands),
    [getCommands],
  );

  const isControlled = value !== undefined;

  // Ref-ify to prevent stale closure in TipTap's onUpdate
  const onValueChangeRef = useRef(onValueChange);
  onValueChangeRef.current = onValueChange;

  const clearSelectionsRef = useRef(() => {});
  clearSelectionsRef.current = () => {
    if (!questionnaire.questions) return;
    const currentQuestion = questionnaire.questions[questionnaire.step];
    // Only clear selections for single-select — multi-select allows text + options together
    if (!currentQuestion?.multiSelect) {
      questionnaire.clearSelections(questionnaire.step);
    }
  };

  // Ref-ify attachment and questionnaire operations to prevent stale closure in TipTap handlers
  const attachmentsRef = useRef(attachments);
  attachmentsRef.current = attachments;

  const questionnaireRef = useRef(questionnaire);
  questionnaireRef.current = questionnaire;

  const tiptapEditor = useEditor({
    immediatelyRender: false,
    extensions: [Document, Paragraph, Text, mentionExtension],
    content: isControlled ? value : "",
    editorProps: {
      attributes: {
        class: cn("max-w-none focus:outline-none w-full"),
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
        // Command-list interception — read plugin state synchronously
        const cmdState = commandListPluginKey.getState(view.state);
        if (cmdState?.isOpen) {
          if (event.key === "Tab") {
            event.preventDefault();
            commandList.selectRef.current?.();
            return true;
          }
          if (event.key === "Escape") {
            event.preventDefault();
            view.dispatch(
              view.state.tr.setMeta(commandListPluginKey, { close: true }),
            );
            return true;
          }
          if (event.key === "ArrowUp") {
            event.preventDefault();
            commandList.navigateRef.current?.(-1);
            return true;
          }
          if (event.key === "ArrowDown") {
            event.preventDefault();
            commandList.navigateRef.current?.(1);
            return true;
          }
          if (event.key === "Enter" && !event.shiftKey) {
            event.preventDefault();
            commandList.selectRef.current?.();
            return true;
          }
        }

        // Questionnaire: Arrow up/down from textarea → blur and navigate to options
        const currentQuestionnaire = questionnaireRef.current;
        if (currentQuestionnaire.questions?.length) {
          if (event.key === "ArrowUp" || event.key === "ArrowDown") {
            event.preventDefault();
            const optionsHandle = currentQuestionnaire.optionsRef.current;
            const direction = event.key === "ArrowUp" ? -1 : 1;
            optionsHandle?.navigate(direction);
            view.dom.blur();
            return true;
          }
        }

        if (event.key === "Backspace" && view.state.doc.textContent === "") {
          const lastItem = attachmentsRef.current.items.at(-1);
          if (lastItem) {
            event.preventDefault();
            attachmentsRef.current.remove(lastItem.id);
            return true;
          }
        }

        if (event.key === "Enter" && !event.shiftKey) {
          event.preventDefault();
          const form = (event.target as HTMLElement).closest("form");
          if (form) form.requestSubmit();
          return true;
        }

        if (event.key === "Enter" && event.shiftKey) {
          const { state, dispatch } = view;
          const { tr } = state;
          dispatch(tr.split(state.selection.$from.pos));
          return true;
        }

        return false;
      },
    },
    onFocus: () => {
      questionnaireRef.current.optionsRef.current?.clearHighlight();
    },
    onMount: ({ editor: instance }) => {
      editor.ref.current = instance;
    },
    onUnmount: () => {
      editor.ref.current = null;
    },
    onUpdate: ({ editor: instance }) => {
      const text = instance.getText();
      editor.setHasContent(text.trim().length > 0 || !instance.isEmpty);
      if (text.trim().length > 0) {
        clearSelectionsRef.current();
        questionnaireRef.current.optionsRef.current?.clearHighlight();
      }
      onValueChangeRef.current?.(text);
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

  // Sync controlled value
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
        "max-h-32 min-h-8 overflow-y-auto px-4 py-2 text-md",
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

// Placeholder
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
    if (children) {
      return Children.toArray(children);
    }
    return [];
  }, [placeholder, children]);

  const isLooping = items.length > 1;

  const loopItems = useMemo(
    () => items.map((item) => (typeof item === "string" ? item : "")),
    [items],
  );
  const { currentItem, key } = useLoop(loopItems, 3000);

  if (!isLooping && items.length === 1) {
    const content = items[0];
    return <div className={cn("text-ink-tertiary", className)}>{content}</div>;
  }

  if (!isLooping && items.length === 0) {
    return null;
  }

  return (
    <div className={cn("pointer-events-none flex")}>
      <AnimatePresence mode="popLayout" initial={false}>
        <motion.span
          key={key}
          initial={{ opacity: 0, y: "100%", filter: "blur(4px)" }}
          animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
          exit={{ opacity: 0, y: "-100%", filter: "blur(4px)" }}
          transition={{ duration: 0.3, ease: "easeOut" }}
          className={cn("text-ink-tertiary", className)}
        >
          {typeof items[0] === "string"
            ? currentItem
            : items[key % items.length]}
        </motion.span>
      </AnimatePresence>
    </div>
  );
};

// Layout sub-components
type ComposerFooterProps = ComponentProps<"div">;

const ComposerActions = ({ className, ...props }: ComposerFooterProps) => (
  <div className={cn("flex justify-end gap-2 p-2", className)} {...props} />
);

// AttachmentTrigger — calls openFileDialog from context
type ComposerAttachmentTriggerProps = ComponentProps<typeof IconButton>;

const ComposerAttachmentTrigger = (props: ComposerAttachmentTriggerProps) => {
  const { attachments } = useComposer();

  return (
    <Attachments.Trigger onClick={attachments.openFileDialog} {...props} />
  );
};

// Submit — auto-disables via context
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
      className={cn("rounded-full", className)}
      disabled={autoDisabled}
      {...props}
    >
      {children ?? <SendIcon />}
    </IconButton>
  );
};

// State — value-matched morphing container
type ComposerStatesProps = ComponentProps<"div"> & {
  value?: string;
};

const ComposerStates = ({
  children,
  className,
  value,
  ...props
}: ComposerStatesProps) => {
  const [ref, bounds] = useMeasure();

  // Find the child whose value matches
  const matchedChild = value
    ? Children.toArray(children).find(
        (child) =>
          isValidElement(child) &&
          (child.props as { value?: string }).value === value,
      )
    : null;
  const hasMatch = matchedChild != null;

  // Hold last non-zero height so the panel doesn't collapse to 0
  // during the AnimatePresence mode="wait" gap between exit and enter.
  const lastHeightRef = useRef(0);
  if (bounds.height > 0) lastHeightRef.current = bounds.height;

  return (
    <div
      data-slot="composer-states"
      className={cn(
        "overflow-hidden transition-transform",
        hasMatch && "pb-2",
        className,
      )}
      {...props}
    >
      <MotionConfig
        transition={{
          duration: 0.3,
          type: "spring",
          bounce: 0,
        }}
      >
        <AnimatePresence initial={false}>
          {hasMatch && (
            <motion.div
              initial={{ y: "100%", opacity: 0 }}
              animate={{
                y: 0,
                opacity: 1,
                height: bounds.height,
              }}
              exit={{ y: "100%", opacity: 0 }}
              className="overflow-hidden box-content border border-primary-border bg-primary rounded-4xl shadow-xs [corner-shape:squircle]"
            >
              <div ref={ref} className="relative">
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

// StateItem — crossfade wrapper for content inside Composer.State
type ComposerStateProps = {
  value: string;
  children: ReactNode;
} & Omit<ComponentProps<typeof motion.div>, "value">;

const ComposerState = ({ value, children, ...props }: ComposerStateProps) => (
  <motion.div
    key={value}
    data-slot="composer-state"
    initial={{ opacity: 0, filter: "blur(8px)" }}
    animate={{ opacity: 1, filter: "blur(0px)" }}
    exit={{ opacity: 0, filter: "blur(8px)" }}
    {...props}
  >
    {children}
  </motion.div>
);

// Questionnaire — composes Questionnaire primitives with ComposerContext data.
// Holds a snapshot of questions so it can still render during exit animations
// (the parent unmounts this via AnimatePresence, but context clears first).
const ComposerQuestionnaire = () => {
  const { questionnaire } = useComposer();

  // Hold last valid question so content stays rendered during exit animations.
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

// DismissAction — ghost button with ESC indicator
type ComposerDismissActionProps = ComponentProps<typeof Button>;

const ComposerDismissAction = ({
  className,
  ...props
}: ComposerDismissActionProps) => {
  const { questionnaire } = useComposer();
  return (
    <Button
      type="button"
      variant="ghost"
      className={cn("gap-2", className)}
      onClick={questionnaire.dismissStep}
      {...props}
    >
      Dismiss
      <kbd className="pointer-events-none text-2xs text-ink-tertiary font-normal">
        ESC
      </kbd>
    </Button>
  );
};

// ContinueAction — submit button for questionnaire
type ComposerContinueActionProps = ComponentProps<typeof Button>;

const ComposerContinueAction = ({
  className,
  ...props
}: ComposerContinueActionProps) => {
  const { questionnaire } = useComposer();
  return (
    <Button
      variant="tertiary"
      type="submit"
      className={cn("gap-2", className)}
      {...props}
    >
      {questionnaire.isLastStep ? "Submit" : "Continue"}
      <kbd className="pointer-events-none text-2xs text-ink-tertiary font-normal">
        ↵
      </kbd>
    </Button>
  );
};

// Hints — keyboard shortcut hints for questionnaire, rendered in the actions bar
type ComposerHintsProps = ComponentProps<typeof Questionnaire.Hints>;

const ComposerHints = ({ className, ...props }: ComposerHintsProps) => {
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

// ---------------------------------------------------------------------------
// <Composer.CommandList prefix> — props-driven, render-fn-based command list
//
// Reads `commands[prefix]` from context, applies the prefix's filter to its
// items against the active query, and invokes the render-fn child for each
// surviving entry. Renders nothing unless `prefix` matches the active prefix.
//
// Keyboard navigation: <Composer.CommandItem> children register themselves
// on mount, in render order. Arrow keys move highlight; Enter/Tab selects.
// ---------------------------------------------------------------------------

type CommandListRowHandle = {
  value: string;
};

type CommandListNavContextValue = {
  registerRow: (handle: CommandListRowHandle) => () => void;
  highlightedValue: string | null;
  setHighlightedValue: (value: string | null) => void;
  selectByValue: (value: string) => void;
};

const CommandListNavContext =
  createContext<CommandListNavContextValue | null>(null);

type ComposerCommandListProps<TItem> = {
  prefix: string;
  className?: string;
  /**
   * Render function — called for each filtered entry. Type the parameter at
   * the callsite (e.g. `{(item: MentionData) => ...}`); TypeScript infers
   * `TItem` from there, so no inline JSX generic is needed.
   */
  children: (item: TItem) => ReactNode;
};

const ComposerCommandList = <TItem,>({
  prefix,
  className,
  children: renderItem,
}: ComposerCommandListProps<TItem>): ReactNode => {
  const { commandList, commands, editor, tools, attachments } = useComposer();
  const config = commands[prefix];
  const isActive = commandList.open && commandList.currentPrefix === prefix;

  const filteredItems = useMemo(() => {
    if (!config) return [];
    return filterCommandItems(config.items, commandList.query, config.filter);
  }, [config, commandList.query]);

  const [rows, setRows] = useState<CommandListRowHandle[]>([]);
  const [highlightedValue, setHighlightedValue] = useState<string | null>(
    null,
  );

  // Keep highlight valid: snap to first row when it isn't.
  const validHighlight =
    highlightedValue !== null &&
    rows.some((r) => r.value === highlightedValue);
  if (!validHighlight && rows.length > 0) {
    queueMicrotask(() => setHighlightedValue(rows[0].value));
  } else if (rows.length === 0 && highlightedValue !== null) {
    queueMicrotask(() => setHighlightedValue(null));
  }

  const registerRow = useCallback((handle: CommandListRowHandle) => {
    setRows((prev) => [...prev, handle]);
    return () => {
      setRows((prev) => prev.filter((entry) => entry !== handle));
    };
  }, []);

  const selectByValue = useCallback(
    (value: string) => {
      const tiptapEditor = editor.ref.current;
      if (!tiptapEditor || !config) return;
      // Look up the source item from the data array. label and onSelect come
      // from here — CommandItem itself only carries `value`.
      const dataItem = config.items.find(
        (i) => (i as { value?: string } | null)?.value === value,
      ) as CommandItemData | undefined;
      if (!dataItem) return;

      const pluginState = commandListPluginKey.getState(tiptapEditor.state);
      const triggerStartPosition = pluginState?.triggerStartPosition ?? 0;
      const cursorPosition = tiptapEditor.state.selection.$from.pos;

      if (config.kind === "chip") {
        tiptapEditor
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
        tiptapEditor
          .chain()
          .focus()
          .deleteRange({ from: triggerStartPosition, to: cursorPosition })
          .run();
        dataItem.onSelect?.({ editor: tiptapEditor, tools, attachments });
      }

      tiptapEditor.view.dispatch(
        tiptapEditor.state.tr.setMeta(commandListPluginKey, { close: true }),
      );
    },
    [editor, config, prefix, tools, attachments],
  );

  // Wire keyboard refs while active.
  if (isActive) {
    commandList.selectRef.current = highlightedValue
      ? () => selectByValue(highlightedValue)
      : null;
    commandList.navigateRef.current = (direction: number) => {
      if (rows.length === 0) return;
      const currentIdx = rows.findIndex((r) => r.value === highlightedValue);
      const nextIdx =
        currentIdx === -1
          ? 0
          : (currentIdx + direction + rows.length) % rows.length;
      setHighlightedValue(rows[nextIdx].value);
    };
  }

  const navCtx = useMemo<CommandListNavContextValue>(
    () => ({
      registerRow,
      highlightedValue,
      setHighlightedValue,
      selectByValue,
    }),
    [registerRow, highlightedValue, selectByValue],
  );

  if (!isActive || !config) return null;

  if (filteredItems.length === 0) {
    return (
      <Commands className={className}>
        <Commands.Empty>No results</Commands.Empty>
      </Commands>
    );
  }

  return (
    <CommandListNavContext.Provider value={navCtx}>
      <Commands className={className}>
        {filteredItems.map((item, i) => (
          <Fragment
            key={
              (item as { value?: string } | null)?.value ?? `__cmd_${i}`
            }
          >
            {renderItem(item as TItem)}
          </Fragment>
        ))}
      </Commands>
    </CommandListNavContext.Provider>
  );
};

// ---------------------------------------------------------------------------
// <Composer.CommandItem> — visual row that registers with the nav context.
// Place inside the render-fn child of <Composer.CommandList>.
// ---------------------------------------------------------------------------

type ComposerCommandItemProps = {
  /**
   * Stable identifier — joins back to the source data in
   * `commands[prefix].items` for label/onSelect/etc. Also used for highlight
   * matching and chip serialization.
   */
  value: string;
  /** Free-form row content. */
  children?: ReactNode;
};

const ComposerCommandItem = ({
  value,
  children,
}: ComposerCommandItemProps) => {
  const navCtx = useContext(CommandListNavContext);
  if (!navCtx) {
    throw new Error(
      "<Composer.CommandItem> must be rendered inside <Composer.CommandList>.",
    );
  }

  // Register with the parent list on mount.
  useEffect(() => {
    return navCtx.registerRow({ value });
  }, [navCtx, value]);

  const isHighlighted = navCtx.highlightedValue === value;

  return (
    <Commands.Item
      highlighted={isHighlighted}
      onMouseDown={(event) => {
        event.preventDefault();
        navCtx.selectByValue(value);
      }}
      onMouseEnter={() => navCtx.setHighlightedValue(value)}
    >
      {children}
    </Commands.Item>
  );
};

// ---------------------------------------------------------------------------
// <Composer.CommandItemIcon> — slot wrapper for the row icon. Children are
// rendered as the icon JSX; a `data-slot` is set for styling/targeting.
// ---------------------------------------------------------------------------

type ComposerCommandItemIconProps = ComponentProps<"span">;

const ComposerCommandItemIcon = ({
  children,
  className,
  ...props
}: ComposerCommandItemIconProps) => (
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

// ---------------------------------------------------------------------------
// <Composer.CommandGroup> / <Composer.CommandGroupLabel> /
// <Composer.CommandCollection> — Base-UI-style two-tier rendering.
//
//   <Composer.CommandList prefix="/">
//     {(group) => (
//       <Composer.CommandGroup>
//         <Composer.CommandGroupLabel>{group.label}</Composer.CommandGroupLabel>
//         <Composer.CommandCollection items={group.items}>
//           {(item) => <Composer.CommandItem ... />}
//         </Composer.CommandCollection>
//       </Composer.CommandGroup>
//     )}
//   </Composer.CommandList>
// ---------------------------------------------------------------------------

type ComposerCommandGroupProps = ComponentProps<"div">;

const ComposerCommandGroup = ({
  className,
  children,
  ...props
}: ComposerCommandGroupProps) => (
  <Commands.Group className={className} {...props}>
    {children}
  </Commands.Group>
);

type ComposerCommandGroupLabelProps = ComponentProps<"div">;

const ComposerCommandGroupLabel = ({
  className,
  children,
  ...props
}: ComposerCommandGroupLabelProps) => (
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

function ComposerCommandCollection<TItem>({
  items,
  children: renderItem,
}: ComposerCommandCollectionProps<TItem>): ReactNode {
  return (
    <>
      {items.map((item, i) => (
        <Fragment
          key={(item as { value?: string } | null)?.value ?? `__col_${i}`}
        >
          {renderItem(item)}
        </Fragment>
      ))}
    </>
  );
}

// Compound export
export const Composer = Object.assign(ComposerRoot, {
  Container: ComposerContainer,
  Attachments: ComposerAttachments,
  AttachmentTrigger: ComposerAttachmentTrigger,
  Actions: ComposerActions,
  Placeholder: ComposerPlaceholder,
  Submit: ComposerSubmit,
  States: ComposerStates,
  State: ComposerState,
  Textarea: ComposerTextarea,
  Questionnaire: ComposerQuestionnaire,
  CommandList: ComposerCommandList,
  CommandItem: ComposerCommandItem,
  CommandItemIcon: ComposerCommandItemIcon,
  CommandGroup: ComposerCommandGroup,
  CommandGroupLabel: ComposerCommandGroupLabel,
  CommandCollection: ComposerCommandCollection,
  DismissAction: ComposerDismissAction,
  ContinueAction: ComposerContinueAction,
  Hints: ComposerHints,
});
