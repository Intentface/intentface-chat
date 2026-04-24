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
  useEditorState,
} from "@tiptap/react";
import type { FileUIPart } from "ai";
import { AnimatePresence, MotionConfig, motion } from "motion/react";
import React, {
  type ChangeEvent,
  Children,
  type ComponentProps,
  createContext,
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
import { BrainIcon } from "@/components/icons/brain";
import { FileChartIcon } from "@/components/icons/file-chart";
import { FileTextIcon } from "@/components/icons/file-text";
import { GlobeIcon } from "@/components/icons/globe";
import { ImageAltIcon } from "@/components/icons/image-alt";
import { SendIcon } from "@/components/icons/send";
import { SpreadsheetIcon } from "@/components/icons/spreadsheet";
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
import type { AskUserQuestion } from "@/tools/ask-user";
import { BubbleWideSparkleIcon } from "../icons/bubble-wide-sparkle";
import { CodeIcon } from "../icons/code";

// ---------------------------------------------------------------------------
// Command types & data
// ---------------------------------------------------------------------------

type CommandItem = {
  id: string;
  label: string;
  icon: React.ComponentType<React.SVGProps<SVGSVGElement>>;
  group: string;
  kind: "mention" | "command";
  value: string;
  description?: string;
};

type CommandTrigger = "@" | "/";

type CommandListState = {
  isOpen: boolean;
  trigger: CommandTrigger | null;
  query: string;
  triggerStartPosition: number;
};

const CLOSED_COMMAND_STATE: CommandListState = {
  isOpen: false,
  trigger: null,
  query: "",
  triggerStartPosition: 0,
};

const MENTION_ITEMS: CommandItem[] = [
  {
    id: "quarterly-report",
    label: "Q4 Quarterly Report",
    icon: FileTextIcon,
    group: "",
    kind: "mention",
    value: "quarterly-report",
  },
  {
    id: "meeting-notes",
    label: "Meeting Notes - March 2026",
    icon: FileTextIcon,
    group: "",
    kind: "mention",
    value: "meeting-notes",
  },
  {
    id: "product-roadmap",
    label: "Product Roadmap",
    icon: SpreadsheetIcon,
    group: "",
    kind: "mention",
    value: "product-roadmap",
  },
  {
    id: "brand-guidelines",
    label: "Brand Guidelines",
    icon: FileTextIcon,
    group: "",
    kind: "mention",
    value: "brand-guidelines",
  },
  {
    id: "api-documentation",
    label: "API Documentation",
    icon: FileChartIcon,
    group: "",
    kind: "mention",
    value: "api-documentation",
  },
  {
    id: "screenshot-dashboard",
    label: "Screenshot - Dashboard",
    icon: ImageAltIcon,
    group: "",
    kind: "mention",
    value: "screenshot-dashboard",
  },
  {
    id: "wireframe-checkout",
    label: "Wireframe - Checkout Flow",
    icon: ImageAltIcon,
    group: "",
    kind: "mention",
    value: "wireframe-checkout",
  },
];

const COMMAND_ITEMS: CommandItem[] = [
  {
    id: "search",
    label: "Search the web",
    icon: GlobeIcon,
    group: "Tools",
    kind: "command",
    value: "webSearch",
    description: "Enable web search for this message",
  },
  {
    id: "code-execution",
    label: "Code Execution",
    icon: CodeIcon,
    group: "Tools",
    kind: "command",
    value: "codeExecution",
    description: "Run code snippets",
  },
  {
    id: "think",
    label: "Think deeply",
    icon: BrainIcon,
    group: "Tools",
    kind: "command",
    value: "thinking",
    description: "Enable extended thinking",
  },
  {
    id: "summarize",
    label: "Summarize",
    icon: BubbleWideSparkleIcon,
    group: "Tools",
    kind: "command",
    value: "summarize",
    description: "Summarize the conversation",
  },
];

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

const filterCommandItems = (
  items: CommandItem[],
  query: string,
): CommandItem[] => {
  if (!query) return items;
  return items
    .map((item) => ({ item, score: fuzzyScore(query, item.label) }))
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score)
    .map(({ item }) => item);
};

// ---------------------------------------------------------------------------
// ProseMirror Plugin — trigger detection for @ and /
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

const createCommandListPlugin = () =>
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

        const { selection } = newEditorState;
        const cursorPosition = selection.$from.pos;
        const blockStart = selection.$from.start();
        const textBeforeCursor = newEditorState.doc.textBetween(
          blockStart,
          cursorPosition,
          "\n",
        );

        // / trigger — position 0 only (entire doc starts with /)
        const fullDocText = newEditorState.doc.textContent;
        if (fullDocText.startsWith("/")) {
          const query = fullDocText.slice(1);
          if (
            query.includes(" ") &&
            filterCommandItems(COMMAND_ITEMS, query.split(" ")[0]).length === 0
          ) {
            return CLOSED_COMMAND_STATE;
          }
          return {
            isOpen: true,
            trigger: "/" as CommandTrigger,
            query,
            triggerStartPosition: blockStart,
          };
        }

        // @ trigger — after whitespace or at start of text block
        const atMatch = textBeforeCursor.match(/(^|[\s])@([^\s]*)$/);
        if (atMatch) {
          const query = atMatch[2];
          const triggerStartPosition = cursorPosition - query.length - 1;
          return {
            isOpen: true,
            trigger: "@" as CommandTrigger,
            query,
            triggerStartPosition,
          };
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
// ---------------------------------------------------------------------------

const ICON_MAP: Record<
  string,
  React.ComponentType<React.SVGProps<SVGSVGElement>>
> = {
  "quarterly-report": FileTextIcon,
  "meeting-notes": FileTextIcon,
  "product-roadmap": SpreadsheetIcon,
  "brand-guidelines": FileTextIcon,
  "api-documentation": FileChartIcon,
  "screenshot-dashboard": ImageAltIcon,
  "wireframe-checkout": ImageAltIcon,
  search: GlobeIcon,
  "code-execution": CodeIcon,
  summarize: BubbleWideSparkleIcon,
  think: BrainIcon,
};

const MentionChipNodeView = ({
  node,
}: {
  node: { attrs: Record<string, unknown> };
}) => {
  const label = node.attrs.label as string;
  const icon = node.attrs.icon as string;
  const Icon = ICON_MAP[icon];
  return (
    <NodeViewWrapper
      as="span"
      data-mention-chip
      className="inline-flex items-center gap-0.5"
    >
      {Icon && (
        <span className="relative w-4 h-[1em]">
          <Icon className="size-4 text-ink-tertiary absolute top-1/2 left-0 -translate-y-1/2" />
        </span>
      )}
      <span>{label}</span>
    </NodeViewWrapper>
  );
};

const MentionChipExtension = TiptapNode.create({
  name: "mentionChip",
  group: "inline",
  inline: true,
  atom: true,

  addAttributes() {
    return {
      label: { default: "" },
      value: { default: "" },
      icon: { default: "" },
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
    return [createCommandListPlugin()];
  },
});

// ---------------------------------------------------------------------------
// Composer
// ---------------------------------------------------------------------------

type AnswerEntry = { selected: Set<string>; freeText: string };

type ComposerContextValue = {
  editor: {
    ref: RefObject<Editor | null>;
    hasContent: boolean;
    setHasContent: (has: boolean) => void;
    isSubmitting: boolean;
  };
  attachments: {
    items: AttachmentItem[];
    add: (files: File[] | FileList) => void;
    remove: (id: string) => void;
    openFileDialog: () => void;
    error: string | null;
    isDragging: boolean;
    fileInputRef: RefObject<HTMLInputElement | null>;
    globalDropRef: RefObject<boolean>;
  };
  tools: {
    webSearch: boolean;
    setWebSearch: (value: boolean) => void;
    thinking: boolean;
    setThinking: (value: boolean) => void;
  };
  questionnaire: {
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
  mentions: {
    open: boolean;
    setOpen: (open: boolean) => void;
    selectRef: RefObject<(() => void) | null>;
    navigateRef: RefObject<((direction: number) => void) | null>;
    items: CommandItem[];
  };
  commands: {
    open: boolean;
    setOpen: (open: boolean) => void;
    selectRef: RefObject<(() => void) | null>;
    navigateRef: RefObject<((direction: number) => void) | null>;
    items: CommandItem[];
  };
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
  mentions: {
    open: false,
    setOpen: () => {},
    selectRef: { current: null },
    navigateRef: { current: null },
    items: MENTION_ITEMS,
  },
  commands: {
    open: false,
    setOpen: () => {},
    selectRef: { current: null },
    navigateRef: { current: null },
    items: COMMAND_ITEMS,
  },
});

export const useComposer = () => useContext(ComposerContext);

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

// Root — renders <form>, owns submit lifecycle
type ComposerRootProps = Omit<ComponentProps<"form">, "onSubmit"> & {
  onSubmit?: (data: {
    text: string;
    files: FileUIPart[];
    webSearch: boolean;
    thinking: boolean;
  }) => void | Promise<void>;
  isSubmitting?: boolean;
  questions?: AskUserQuestion[];
  onQuestionsSubmit?: (answers: Record<string, string>) => void;
  attachmentAccept?: string;
  attachmentMaxFiles?: number;
  attachmentMaxFileSize?: number;
};

const ComposerRoot = ({
  children,
  className,
  onSubmit,
  isSubmitting = false,
  questions,
  onQuestionsSubmit,
  attachmentAccept: accept = DEFAULT_ATTACHMENT_ACCEPT,
  attachmentMaxFiles: maxFiles = DEFAULT_ATTACHMENT_MAX_FILES,
  attachmentMaxFileSize: maxFileSize = DEFAULT_ATTACHMENT_MAX_FILE_SIZE,
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
  const [activeTrigger, setActiveTrigger] = useState<CommandTrigger | null>(
    null,
  );
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
        onQuestionsSubmit?.(compileAnswers(updatedAnswers));
        editorRef.current?.commands.focus();
      }
    },
    [questions, questionnaireStep, onQuestionsSubmit, compileAnswers],
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
      onQuestionsSubmit?.(compileAnswers(updatedAnswers));
      editorRef.current?.commands.focus();
    }
  }, [questions, questionnaireStep, onQuestionsSubmit, compileAnswers]);

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

    revokeAllAttachmentUrls(attachmentItems);
    setAttachmentItems([]);
    editorRef.current?.commands.setContent("");
    setEditorHasContent(false);

    await onSubmit?.({ text: submitText, files, webSearch, thinking });
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
      mentions: {
        open: activeTrigger === "@",
        setOpen: (open: boolean) => setActiveTrigger(open ? "@" : null),
        selectRef: commandListSelectRef,
        navigateRef: commandListNavigateRef,
        items: MENTION_ITEMS,
      },
      commands: {
        open: activeTrigger === "/",
        setOpen: (open: boolean) => setActiveTrigger(open ? "/" : null),
        selectRef: commandListSelectRef,
        navigateRef: commandListNavigateRef,
        items: COMMAND_ITEMS,
      },
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
      activeTrigger,
    ],
  );

  return (
    <ComposerContext.Provider value={contextValue}>
      <form
        onSubmit={handleFormSubmit}
        ref={rootRef}
        className={cn("relative w-full flex flex-col", className)}
        {...formProps}
      >
        {children}
      </form>
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
  const { editor, attachments, questionnaire, mentions, commands } =
    useComposer();

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
    extensions: [Document, Paragraph, Text, MentionChipExtension],
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
        // Mentions/commands interception — read plugin state synchronously
        const cmdState = commandListPluginKey.getState(view.state);
        if (cmdState?.isOpen) {
          const active = cmdState.trigger === "@" ? mentions : commands;
          if (event.key === "Tab") {
            event.preventDefault();
            active.selectRef.current?.();
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
            active.navigateRef.current?.(-1);
            return true;
          }
          if (event.key === "ArrowDown") {
            event.preventDefault();
            active.navigateRef.current?.(1);
            return true;
          }
          if (event.key === "Enter" && !event.shiftKey) {
            event.preventDefault();
            active.selectRef.current?.();
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
      if (pluginState?.isOpen && pluginState.trigger) {
        (pluginState.trigger === "@" ? mentions : commands).setOpen(true);
      } else {
        mentions.setOpen(false);
      }
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

// CommandList — reads plugin state, renders grouped items, manages selection
type ComposerCommandListProps = { className?: string };

const ComposerCommandList = ({ className }: ComposerCommandListProps) => {
  const { editor, mentions, commands, tools } = useComposer();

  const tiptapEditor = editor.ref.current;
  const active = mentions.open ? mentions : commands.open ? commands : null;

  const commandState =
    useEditorState({
      editor: tiptapEditor,
      selector: ({ editor: currentEditor }) => {
        if (!currentEditor) return CLOSED_COMMAND_STATE;
        return (
          commandListPluginKey.getState(currentEditor.state) ??
          CLOSED_COMMAND_STATE
        );
      },
    }) ?? CLOSED_COMMAND_STATE;

  const { isOpen, trigger, query, triggerStartPosition } = commandState;

  const items = useMemo(() => {
    if (!isOpen || !trigger) return [];
    const source = trigger === "@" ? mentions.items : commands.items;
    return filterCommandItems(source, query);
  }, [isOpen, trigger, query, mentions.items, commands.items]);

  const [selectedIndex, setSelectedIndex] = useState(0);

  // Reset selected index when items change (inline ref comparison, no useEffect)
  const previousItemsLengthRef = useRef(items.length);
  if (previousItemsLengthRef.current !== items.length) {
    previousItemsLengthRef.current = items.length;
    setSelectedIndex(0);
  }

  const handleSelect = useCallback(
    (item: CommandItem) => {
      if (!tiptapEditor) return;

      const cursorPosition = tiptapEditor.state.selection.$from.pos;

      if (item.kind === "mention") {
        tiptapEditor
          .chain()
          .focus()
          .deleteRange({ from: triggerStartPosition, to: cursorPosition })
          .insertContentAt(triggerStartPosition, {
            type: "mentionChip",
            attrs: { label: item.label, value: item.value, icon: item.id },
          })
          .run();
      } else {
        // Command: delete trigger text and toggle state
        tiptapEditor
          .chain()
          .focus()
          .deleteRange({ from: triggerStartPosition, to: cursorPosition })
          .run();

        if (item.value === "webSearch") tools.setWebSearch(true);
        if (item.value === "thinking") tools.setThinking(true);
      }

      // Close command list
      tiptapEditor.view.dispatch(
        tiptapEditor.state.tr.setMeta(commandListPluginKey, { close: true }),
      );
    },
    [tiptapEditor, triggerStartPosition, tools],
  );

  // Register refs for keyboard handlers
  if (active) {
    active.selectRef.current =
      items.length > 0 ? () => handleSelect(items[selectedIndex]) : null;
    active.navigateRef.current = (direction: number) => {
      setSelectedIndex((previous) => {
        const next = previous + direction;
        if (next < 0) return items.length - 1;
        if (next >= items.length) return 0;
        return next;
      });
    };
  }

  if (!isOpen) return null;

  if (items.length === 0) {
    return (
      <Commands className={className}>
        <Commands.Empty>No results</Commands.Empty>
      </Commands>
    );
  }

  // Group items
  const groups = new Map<string, CommandItem[]>();
  for (const item of items) {
    const existing = groups.get(item.group);
    if (existing) {
      existing.push(item);
    } else {
      groups.set(item.group, [item]);
    }
  }

  let flatIndex = 0;

  return (
    <Commands className={className}>
      {[...groups.entries()].map(([groupName, groupItems]) => (
        <Commands.Group key={groupName}>
          {/* <Commands.GroupLabel>{groupName}</Commands.GroupLabel> */}
          {groupItems.map((item) => {
            const currentFlatIndex = flatIndex++;
            return (
              <Commands.Item
                key={item.id}
                icon={item.icon}
                highlighted={currentFlatIndex === selectedIndex}
                onMouseDown={(event) => {
                  event.preventDefault();
                  handleSelect(item);
                }}
                onMouseEnter={() => setSelectedIndex(currentFlatIndex)}
              >
                <Commands.ItemLabel>{item.label}</Commands.ItemLabel>
                {item.description && (
                  <Commands.ItemDescription>
                    {item.description}
                  </Commands.ItemDescription>
                )}
              </Commands.Item>
            );
          })}
        </Commands.Group>
      ))}
    </Commands>
  );
};

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
  DismissAction: ComposerDismissAction,
  ContinueAction: ComposerContinueAction,
  Hints: ComposerHints,
  CommandList: ComposerCommandList,
});
