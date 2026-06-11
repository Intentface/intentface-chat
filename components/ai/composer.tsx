"use client";

import { mergeAttributes, Node as TiptapNode } from "@tiptap/core";
import Document from "@tiptap/extension-document";
import Paragraph from "@tiptap/extension-paragraph";
import Text from "@tiptap/extension-text";
import { Plugin, PluginKey, TextSelection } from "@tiptap/pm/state";
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
import { StopIcon } from "@/components/icons/stop";
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

// The single ComposerEditorHandle implementation plus the read/serialize
// operations internal callers need. Exported so modules outside
// the <Composer> tree (e.g. thread message actions) can drive the editor;
// inside the tree it is also reachable as the `textarea` slice on useComposer.
export type ComposerEditorState = ComposerEditorHandle & {
  getText: () => string;
  setText: (text: string) => void;
  serialize: () => { text: string; chips: ChipData[] };
  ensureFocus: () => void;
};

export const composerController: ComposerEditorState = {
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
  // End of the active token (after its last character). The token — prefix plus
  // its whole non-whitespace run — is treated as a single unit: badge, delete-on-
  // select range, and arrow-key trapping all span [start, end], independent of
  // where the caret sits inside it.
  triggerEndPosition: number;
  // Start position of a token the user explicitly dismissed (Escape / Dismiss).
  // Suppresses re-opening that same token until its prefix is removed; mapped
  // forward through every doc change so it keeps tracking the right spot.
  dismissedAt: number | null;
};

const CLOSED_COMMAND_STATE: CommandListPluginState = {
  isOpen: false,
  trigger: null,
  query: "",
  triggerStartPosition: 0,
  triggerEndPosition: 0,
  dismissedAt: null,
};

const detectActivePrefix = (args: {
  registered: RegisteredPrefix[];
  blockStart: number;
  blockEnd: number;
  cursorPosition: number;
  textBeforeCursor: string;
  textAfterCursor: string;
  fullDocText: string;
}): CommandListPluginState => {
  const {
    registered,
    blockStart,
    blockEnd,
    cursorPosition,
    textBeforeCursor,
    textAfterCursor,
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
          triggerEndPosition: blockEnd,
          dismissedAt: null,
        };
      }
      continue;
    }

    // The token is the contiguous non-whitespace run the caret sits inside,
    // taken from both sides of the caret so it stays whole as the caret moves
    // within it. Text chars map 1:1 to positions and an atomic chip can never
    // sit inside a run, so the run length is the position delta on each side.
    const leftRun = textBeforeCursor.match(/\S*$/)?.[0] ?? "";
    const rightRun = textAfterCursor.match(/^\S*/)?.[0] ?? "";
    const runText = leftRun + rightRun;
    if (!runText.startsWith(entry.prefix)) continue;

    // The prefix must sit at a word boundary: line start or after whitespace.
    const charBeforeRun = textBeforeCursor
      .slice(0, textBeforeCursor.length - leftRun.length)
      .at(-1);
    if (charBeforeRun !== undefined && !/\s/.test(charBeforeRun)) continue;

    return {
      isOpen: true,
      trigger: entry.prefix,
      query: runText.slice(entry.prefix.length),
      triggerStartPosition: cursorPosition - leftRun.length,
      triggerEndPosition: cursorPosition + rightRun.length,
      dismissedAt: null,
    };
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
  const classes = pluginState.query ? BADGE_CLASSES : `${BADGE_CLASSES} ${PLACEHOLDER_CLASSES}`;
  // Highlight the whole token, not just up to the caret, so the badge stays put
  // while the caret roams inside it.
  const inline = Decoration.inline(
    pluginState.triggerStartPosition,
    pluginState.triggerEndPosition,
    { class: classes },
  );
  return DecorationSet.create(state.doc, [inline]);
};

const createCommandListPlugin = (getRegisteredPrefixes: () => RegisteredPrefix[]) =>
  new Plugin<CommandListPluginState>({
    key: commandListPluginKey,
    state: {
      init: () => CLOSED_COMMAND_STATE,
      apply(transaction, previousState, _oldEditorState, newEditorState) {
        const meta = transaction.getMeta(commandListPluginKey);
        // Escape / Dismiss: close and remember the token's start so re-entering
        // it won't reopen the popup (only present when something was open).
        if (meta?.close) {
          return {
            ...CLOSED_COMMAND_STATE,
            dismissedAt: previousState.isOpen ? previousState.triggerStartPosition : null,
          };
        }

        const registered = getRegisteredPrefixes();
        if (registered.length === 0) return CLOSED_COMMAND_STATE;

        // Track the dismissed marker across edits; drop it once its prefix is
        // gone so retyping the trigger starts a fresh attempt.
        let dismissedAt = previousState.dismissedAt;
        if (dismissedAt !== null && transaction.docChanged) {
          const mapped = transaction.mapping.mapResult(dismissedAt, -1);
          dismissedAt = mapped.deleted ? null : mapped.pos;
          if (dismissedAt !== null) {
            const markerPos = dismissedAt;
            const docEnd = newEditorState.doc.content.size;
            const stillPrefixed = registered.some(
              (entry) =>
                markerPos + entry.prefix.length <= docEnd &&
                newEditorState.doc.textBetween(markerPos, markerPos + entry.prefix.length) ===
                  entry.prefix,
            );
            if (!stillPrefixed) dismissedAt = null;
          }
        }

        if (!transaction.docChanged && !transaction.selectionSet) {
          return previousState.dismissedAt === dismissedAt
            ? previousState
            : { ...previousState, dismissedAt };
        }

        const { selection } = newEditorState;
        const cursorPosition = selection.$from.pos;
        const blockStart = selection.$from.start();
        const blockEnd = selection.$from.end();
        const textBeforeCursor = newEditorState.doc.textBetween(blockStart, cursorPosition, "\n");
        const textAfterCursor = newEditorState.doc.textBetween(cursorPosition, blockEnd, "\n");
        const fullDocText = newEditorState.doc.textContent;

        const detected = detectActivePrefix({
          registered,
          blockStart,
          blockEnd,
          cursorPosition,
          textBeforeCursor,
          textAfterCursor,
          fullDocText,
        });

        if (detected.isOpen) {
          // Same token the user dismissed → stay closed. A different token →
          // open and forget the prior dismissal.
          if (dismissedAt !== null && detected.triggerStartPosition === dismissedAt) {
            return { ...CLOSED_COMMAND_STATE, dismissedAt };
          }
          return { ...detected, dismissedAt: null };
        }

        return { ...CLOSED_COMMAND_STATE, dismissedAt };
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
  | { type: "command-caret"; direction: 1 | -1 }
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
    case isCommandListOpen && key === "ArrowLeft":
      return { type: "command-caret", direction: -1 };
    case isCommandListOpen && key === "ArrowRight":
      return { type: "command-caret", direction: 1 };
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

// Toggle an option on the step's entry. Multi-select toggles membership and
// keeps free text; single-select replaces both (option and text are mutually
// exclusive).
const toggleAnswer = (
  answers: Map<number, AnswerEntry>,
  step: number,
  label: string,
  multiSelect: boolean,
) => {
  const next = cloneAnswers(answers);
  const previous = next.get(step) ?? emptyEntry();
  const selected = new Set(previous.selected);
  if (multiSelect) {
    if (selected.has(label)) selected.delete(label);
    else selected.add(label);
  } else {
    selected.clear();
    selected.add(label);
  }
  next.set(step, { selected, freeText: multiSelect ? previous.freeText : "" });
  return next;
};

// Everything a transition may ask of the outside world. useAskUser executes
// these against the editor controller, the options handle, and the submit
// callback — the transitions below only describe them.
type AskUserEffect =
  | { type: "clear-input" }
  | { type: "set-input-text"; text: string }
  | { type: "focus-input" }
  | { type: "blur-input" }
  | { type: "reset-highlight" }
  | { type: "submit-answers"; answers: ComposerAnswerEntry[] };

type AskUserAction =
  | { type: "toggle-option"; label: string }
  | { type: "select-option"; label: string }
  | { type: "clear-selections" }
  | { type: "continue-step"; freeText: string }
  | { type: "dismiss-step" }
  | { type: "step-back"; currentText: string }
  | { type: "step-forward"; currentText: string };

type AskUserTransition = {
  next: AskUserState;
  effects: AskUserEffect[];
};

// Commit `nextAnswers`, advance one step, and reset the input — then either
// arm the next question (blurred, highlight reset) or compile and submit on
// the last step (input focused for the follow-up message).
const advanceStep = (
  state: AskUserState,
  questions: AskUserQuestion[],
  nextAnswers: Map<number, AnswerEntry>,
): AskUserTransition => {
  const next: AskUserState = { step: state.step + 1, answers: nextAnswers };
  if (state.step < questions.length - 1) {
    return {
      next,
      effects: [{ type: "clear-input" }, { type: "reset-highlight" }, { type: "blur-input" }],
    };
  }
  return {
    next,
    effects: [
      { type: "clear-input" },
      { type: "submit-answers", answers: compileAnswers(next, questions) },
      { type: "focus-input" },
    ],
  };
};

// Navigate to `targetStep`, preserving any in-progress free text on the step
// being left and restoring the target step's saved text into the input.
const transitionToStep = (
  state: AskUserState,
  targetStep: number,
  currentText: string,
): AskUserTransition => {
  if (targetStep === state.step) return { next: state, effects: [] };

  const trimmed = currentText.trim();
  const answers = cloneAnswers(state.answers);
  if (trimmed.length > 0) {
    const previous = answers.get(state.step) ?? emptyEntry();
    answers.set(state.step, { ...previous, freeText: trimmed });
  }

  const next: AskUserState = { step: targetStep, answers };
  return {
    next,
    effects: [
      { type: "set-input-text", text: answers.get(targetStep)?.freeText ?? "" },
      { type: "reset-highlight" },
      { type: "blur-input" },
    ],
  };
};

// The decide half of the ask-user flow, mirroring interpretAskUserKey: map an
// action onto the next state plus the effects to run. Composed actions
// (select-option = toggle + advance) resolve atomically here, so no caller
// ever chains transitions across a stale state snapshot.
const transitionAskUser = (
  state: AskUserState,
  questions: AskUserQuestion[],
  action: AskUserAction,
): AskUserTransition => {
  const multiSelect = !!questions[state.step]?.multiSelect;

  switch (action.type) {
    case "toggle-option":
      return {
        next: {
          ...state,
          answers: toggleAnswer(state.answers, state.step, action.label, multiSelect),
        },
        effects: multiSelect ? [] : [{ type: "clear-input" }],
      };

    case "select-option": {
      const toggled = toggleAnswer(state.answers, state.step, action.label, multiSelect);
      if (multiSelect) return { next: { ...state, answers: toggled }, effects: [] };
      return advanceStep(state, questions, toggled);
    }

    case "clear-selections": {
      const previous = state.answers.get(state.step);
      if (!previous || previous.selected.size === 0) return { next: state, effects: [] };
      const answers = cloneAnswers(state.answers);
      answers.set(state.step, { selected: new Set(), freeText: previous.freeText });
      return { next: { ...state, answers }, effects: [] };
    }

    case "continue-step":
      return advanceStep(
        state,
        questions,
        writeFreeText(state.answers, state.step, action.freeText.trim(), multiSelect),
      );

    case "dismiss-step":
      return advanceStep(state, questions, skipStep(state.answers, state.step));

    case "step-back":
      return transitionToStep(state, Math.max(0, state.step - 1), action.currentText);

    case "step-forward":
      return transitionToStep(
        state,
        Math.min(questions.length - 1, state.step + 1),
        action.currentText,
      );
  }
};

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
  toggleOption: (label: string) => void;
  continueStep: (freeText?: string) => void;
  dismissStep: () => void;
  isLastStep: boolean;
  isSingle: boolean;
  clearSelections: () => void;
  goBack: () => void;
  goNext: () => void;
  optionsRef: RefObject<AskUserOptionsHandle | null>;
};

// Mirror of the command-list plugin state: whether a trigger prefix is
// active, which one, and the query typed after it.
type ComposerCommandsState = {
  isOpen: boolean;
  trigger: string | null;
  query: string;
};

// The effective open panel — `value` is the matched Composer.PanelItem value
// (including the "command-list" override), null while closed.
type ComposerPanelState = {
  isOpen: boolean;
  value: string | null;
};

type ComposerState = {
  // The editor controller methods (stable identities) plus the reactive
  // hasContent flag: const textarea = useComposer((c) => c.textarea)
  textarea: ComposerEditorState & { hasContent: boolean };
  isSubmitting: boolean;
  panel: ComposerPanelState;
  commands: ComposerCommandsState;
  attachments: ComposerAttachmentsState;
  askUser: ComposerAskUserState;
};

// ---------------------------------------------------------------------------
// Composer store — all reactive composer state in one store, so useComposer
// can offer Zustand-style selectors and components re-render only for the
// slice they read. Actions and refs are created once and survive every
// update; a slice's identity changes only when that slice's data changes.
// ---------------------------------------------------------------------------

type ComposerStore = {
  subscribe: (listener: () => void) => () => void;
  getSnapshot: () => ComposerState;
  // Bridges for props and editor/document integrations — not consumer API.
  setHasContent: (value: boolean) => void;
  setIsSubmitting: (value: boolean) => void;
  setPanelValue: (value: string | null) => void;
  setCommands: (next: ComposerCommandsState) => void;
  setQuestions: (questions: AskUserQuestion[] | null) => void;
  setDragging: (active: boolean) => void;
  resetAttachments: () => void;
  activateAskUser: () => () => void;
  reset: () => void;
  // Co-located refs the mounted Composer wires up at runtime.
  attachmentConfigRef: RefObject<AttachmentStoreConfig>;
  submitAnswersRef: RefObject<((answers: ComposerAnswerEntry[]) => void) | null>;
  commandSelectRef: RefObject<(() => void) | null>;
  commandNavigateRef: RefObject<((direction: number) => void) | null>;
};

const createComposerStore = (): ComposerStore => {
  const listeners = new Set<() => void>();
  const notify = () => {
    for (const listener of listeners) listener();
  };

  // Imperative refs co-located with the store; not reactive.
  const optionsRef: RefObject<AskUserOptionsHandle | null> = { current: null };
  const fileInputRef: RefObject<HTMLInputElement | null> = { current: null };
  const globalDropRef: RefObject<boolean> = { current: false };
  const attachmentConfigRef: RefObject<AttachmentStoreConfig> = {
    current: {
      accept: DEFAULT_ATTACHMENT_ACCEPT,
      maxFiles: DEFAULT_ATTACHMENT_MAX_FILES,
      maxFileSize: DEFAULT_ATTACHMENT_MAX_FILE_SIZE,
    },
  };
  const submitAnswersRef: RefObject<((answers: ComposerAnswerEntry[]) => void) | null> = {
    current: null,
  };
  const commandSelectRef: RefObject<(() => void) | null> = { current: null };
  const commandNavigateRef: RefObject<((direction: number) => void) | null> = { current: null };

  // Canonical machine states; the snapshot mirrors them on every update.
  let attachmentState = INITIAL_ATTACHMENT_STATE;
  let askUserMachine = INITIAL_ASK_USER_STATE;
  let snapshot: ComposerState;

  const setHasContent = (value: boolean) => {
    if (snapshot.textarea.hasContent === value) return;
    snapshot = { ...snapshot, textarea: { ...snapshot.textarea, hasContent: value } };
    notify();
  };

  const setIsSubmitting = (value: boolean) => {
    if (snapshot.isSubmitting === value) return;
    snapshot = { ...snapshot, isSubmitting: value };
    notify();
  };

  const setPanelValue = (value: string | null) => {
    if (snapshot.panel.value === value) return;
    snapshot = { ...snapshot, panel: { isOpen: value !== null, value } };
    notify();
  };

  const setCommands = (next: ComposerCommandsState) => {
    const current = snapshot.commands;
    if (
      current.isOpen === next.isOpen &&
      current.trigger === next.trigger &&
      current.query === next.query
    ) {
      return;
    }
    snapshot = { ...snapshot, commands: next };
    notify();
  };

  const dispatchAttachments = (action: AttachmentStoreAction) => {
    const next = attachmentReducer(attachmentState, action, attachmentConfigRef.current);
    if (next === attachmentState) return;
    attachmentState = next;
    snapshot = {
      ...snapshot,
      attachments: { ...snapshot.attachments, items: next.items, error: next.error },
    };
    notify();
  };

  const setDragging = (active: boolean) => {
    if (snapshot.attachments.isDragging === active) return;
    snapshot = { ...snapshot, attachments: { ...snapshot.attachments, isDragging: active } };
    notify();
  };

  // The execute half of the ask-user flow: replay a transition's effects
  // against the editor controller, the options handle, and the submit
  // callback. Input-content state is the editor's own job — tiptap v3 emits
  // update events for programmatic setContent/clearContent.
  const executeAskUserEffects = (effects: AskUserEffect[]) => {
    for (const effect of effects) {
      switch (effect.type) {
        case "clear-input":
          composerController.clear();
          break;
        case "set-input-text":
          composerController.setText(effect.text);
          break;
        case "focus-input":
          composerController.focus();
          break;
        case "blur-input":
          composerController.blur();
          break;
        case "reset-highlight":
          optionsRef.current?.resetHighlight();
          break;
        case "submit-answers":
          submitAnswersRef.current?.(effect.answers);
          break;
      }
    }
  };

  const dispatchAskUser = (action: AskUserAction) => {
    const questions = snapshot.askUser.questions;
    if (!questions || questions.length === 0) return;
    const { next, effects } = transitionAskUser(askUserMachine, questions, action);
    if (next !== askUserMachine) {
      askUserMachine = next;
      snapshot = {
        ...snapshot,
        askUser: {
          ...snapshot.askUser,
          step: next.step,
          answers: next.answers,
          isLastStep: isLastStep(next, questions),
        },
      };
      notify();
    }
    executeAskUserEffects(effects);
  };

  const setQuestions = (questions: AskUserQuestion[] | null) => {
    if (snapshot.askUser.questions === questions) return;
    askUserMachine = INITIAL_ASK_USER_STATE;
    snapshot = {
      ...snapshot,
      askUser: {
        ...snapshot.askUser,
        questions,
        step: askUserMachine.step,
        answers: askUserMachine.answers,
        isLastStep: questions ? isLastStep(askUserMachine, questions) : false,
        isSingle: questions ? questions.length === 1 : false,
      },
    };
    notify();
  };

  // Ask-user mode: while questions are active the options own the keyboard.
  // Entering blurs the editor; document-level keys are interpreted (pure) and
  // dispatched here, so custom AskUser renders keep the behavior for free.
  const activateAskUser = () => {
    composerController.blur();

    const handleKeyDown = (event: KeyboardEvent) => {
      const optionsHandle = optionsRef.current;
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

      switch (action.type) {
        case "dismiss-step":
          dispatchAskUser({ type: "dismiss-step" });
          return;
        case "navigate-options": {
          const newValue = optionsHandle?.navigate(action.direction);
          if (newValue === null) composerController.focus();
          return;
        }
        case "select-option": {
          const item = optionsHandle?.select();
          if (item) dispatchAskUser({ type: "select-option", label: item.value });
          return;
        }
        case "go-back":
          dispatchAskUser({ type: "step-back", currentText: composerController.getText() });
          return;
        case "go-next":
          dispatchAskUser({ type: "step-forward", currentText: composerController.getText() });
          return;
        case "insert-character":
          optionsHandle?.clearHighlight();
          composerController.focus();
          composerController.insertText(action.character);
          return;
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  };

  snapshot = {
    textarea: { ...composerController, hasContent: false },
    isSubmitting: false,
    panel: { isOpen: false, value: null },
    commands: { isOpen: false, trigger: null, query: "" },
    attachments: {
      items: attachmentState.items,
      error: attachmentState.error,
      isDragging: false,
      add: (files) => dispatchAttachments({ type: "add", files }),
      remove: (id) => dispatchAttachments({ type: "remove", id }),
      openFileDialog: () => fileInputRef.current?.click(),
      fileInputRef,
      globalDropRef,
    },
    askUser: {
      questions: null,
      step: askUserMachine.step,
      answers: askUserMachine.answers,
      isLastStep: false,
      isSingle: false,
      toggleOption: (label) => dispatchAskUser({ type: "toggle-option", label }),
      continueStep: (freeText) =>
        dispatchAskUser({ type: "continue-step", freeText: freeText ?? "" }),
      dismissStep: () => dispatchAskUser({ type: "dismiss-step" }),
      clearSelections: () => dispatchAskUser({ type: "clear-selections" }),
      goBack: () =>
        dispatchAskUser({ type: "step-back", currentText: composerController.getText() }),
      goNext: () =>
        dispatchAskUser({ type: "step-forward", currentText: composerController.getText() }),
      optionsRef,
    },
  };

  // Pristine state for reset() — slice actions and refs are reused, so action
  // identities stay stable across resets.
  const initialSnapshot = snapshot;

  // Drop everything mount-scoped when the Composer unmounts (route change):
  // revoke attachment object URLs, then restore the pristine snapshot.
  const reset = () => {
    dispatchAttachments({ type: "reset" });
    askUserMachine = INITIAL_ASK_USER_STATE;
    commandSelectRef.current = null;
    commandNavigateRef.current = null;
    snapshot = initialSnapshot;
    notify();
  };

  return {
    subscribe: (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    getSnapshot: () => snapshot,
    setHasContent,
    setIsSubmitting,
    setPanelValue,
    setCommands,
    setQuestions,
    setDragging,
    resetAttachments: () => dispatchAttachments({ type: "reset" }),
    activateAskUser,
    reset,
    attachmentConfigRef,
    submitAnswersRef,
    commandSelectRef,
    commandNavigateRef,
  };
};

// One composer per page — the same contract composerController already
// encodes. The store is a module singleton, so useComposer works from anywhere
// (thread, toolbars, panels) without a provider. SSR-safe by invariant: every
// write happens in an effect or event handler (client-only), so server renders
// only ever read the pristine initial snapshot.
const composerStore = createComposerStore();

// Subscribe to composer state — from anywhere, no provider needed. With a
// selector, the component re-renders only when the selected value changes
// identity (slices are identity-stable):
//   const askUser = useComposer((composer) => composer.askUser);
// Without one, it returns the full snapshot and re-renders on any change.
export const useComposer = <Selected = ComposerState>(
  selector?: (composer: ComposerState) => Selected,
): Selected => {
  const getValue = () => {
    const state = composerStore.getSnapshot();
    // Safe: without a selector, Selected defaults to ComposerState.
    return selector ? selector(state) : (state as Selected);
  };
  return useSyncExternalStore(composerStore.subscribe, getValue, getValue);
};

type ComposerInternalsValue = {
  editorRef: RefObject<Editor | null>;
  attachmentConfigRef: RefObject<AttachmentStoreConfig>;
  commands: ComposerCommandsMap;
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
  setDragging,
}: {
  rootRef: RefObject<HTMLElement | null>;
  globalDropRef: RefObject<boolean>;
  onFiles: (files: FileList) => void;
  setDragging: (active: boolean) => void;
}) => {
  const onFilesRef = useAsRef(onFiles);

  useEffect(() => {
    const isInScope = (event: DragEvent) =>
      globalDropRef.current || (rootRef.current?.contains(event.target as Node) ?? false);

    const handlers = createDragHandlers({
      isInScope,
      onFiles: (files) => onFilesRef.current(files),
      setDragging,
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
  }, [rootRef, globalDropRef, setDragging]);
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

  const onSubmitRef = useAsRef(onSubmit);

  // Register this mount on the singleton store: answers submit through this
  // mount's onSubmit, and unmounting resets all mount-scoped state so nothing
  // leaks across route changes.
  useEffect(() => {
    composerStore.submitAnswersRef.current = (answers) =>
      onSubmitRef.current?.({ kind: "answers", answers });
    return () => {
      composerStore.submitAnswersRef.current = null;
      composerStore.reset();
    };
  }, []);

  // Prop → store bridges. Actions and refs on the snapshot are identity-stable,
  // so reading them here without subscribing is safe.
  const { add: addAttachments, globalDropRef } = composerStore.getSnapshot().attachments;

  useEffect(() => {
    composerStore.setIsSubmitting(isSubmitting);
  }, [isSubmitting]);

  // Sync the questions prop into the store and arm ask-user mode (editor blur
  // + document-level keyboard handling) while questions are active.
  useEffect(() => {
    composerStore.setQuestions(questions ?? null);
    if (!questions?.length) return;
    return composerStore.activateAskUser();
  }, [questions]);

  const { getRegisteredPrefixes } = useCommandRegistry(commands);

  useDragDropFiles({
    rootRef: formRef,
    globalDropRef,
    onFiles: addAttachments,
    setDragging: composerStore.setDragging,
  });

  const { reportEditorUpdate } = useComposerSnapshot({
    editorRef,
    defaultValue,
    value,
    onValueChange,
  });

  const handleFormSubmit = async (event: React.SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();
    const { askUser, attachments } = composerStore.getSnapshot();

    if (askUser.questions?.length) {
      askUser.continueStep(composerController.getText());
      return;
    }

    if (isSubmitting) return;

    const serialized = composerController.serialize();
    const trimmedText = serialized.text.trim();
    if (!trimmedText && !attachments.items.length) return;

    const submitText = trimmedText || "Sent with attachments";
    const fileItems: AttachmentItem[] = attachments.items;
    const fileParts = fileItems.length > 0 ? await prepareAttachmentsForSend(fileItems) : [];

    composerStore.resetAttachments();
    composerController.clear();

    await onSubmitRef.current?.({
      kind: "message",
      text: submitText,
      files: fileParts,
      chips: serialized.chips,
    });
  };

  const internalsValue = useMemo<ComposerInternalsValue>(
    () => ({
      editorRef,
      attachmentConfigRef: composerStore.attachmentConfigRef,
      commands,
      getRegisteredPrefixes,
      reportEditorUpdate,
    }),
    [commands, getRegisteredPrefixes, reportEditorUpdate],
  );

  return (
    <ComposerInternalsContext.Provider value={internalsValue}>
      <form
        data-slot="composer-root"
        onSubmit={handleFormSubmit}
        ref={formRef}
        className={cn("relative w-full flex flex-col", className)}
        {...formProps}
      >
        {children}
      </form>
    </ComposerInternalsContext.Provider>
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
        // Positioned so it paints above the context window peeking out from
        // behind its top edge.
        "relative border border-primary-border bg-primary rounded-4xl shadow-xs [corner-shape:squircle] cursor-text transition-colors",
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
  const attachments = useComposer((composer) => composer.attachments);
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
  const attachments = useComposer((composer) => composer.attachments);

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
  const hasContent = useComposer((composer) => composer.textarea.hasContent);
  const { editorRef, getRegisteredPrefixes, reportEditorUpdate } = useComposerInternals();

  const isControlled = value !== undefined;

  const onValueChangeRef = useAsRef(onValueChange);

  // Single-select questions clear their selection once the user starts typing
  // a free-text answer. Stable across renders — event-time reads go through
  // the store, so no subscription is needed.
  const clearSelectionsIfSingle = useCallback(() => {
    const { askUser } = composerStore.getSnapshot();
    if (!askUser.questions) return;
    const currentQuestion = askUser.questions[askUser.step];
    if (!currentQuestion?.multiSelect) {
      askUser.clearSelections();
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
            composerStore.getSnapshot().attachments.add(files);
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
            hasActiveAskUser: (composerStore.getSnapshot().askUser.questions?.length ?? 0) > 0,
            isEditorEmpty: view.state.doc.textContent === "",
            hasAttachments: composerStore.getSnapshot().attachments.items.length > 0,
          },
        );

        if (!action) return false;

        switch (action.type) {
          case "command-select": {
            event.preventDefault();
            composerStore.commandSelectRef.current?.();
            return true;
          }
          case "command-close": {
            event.preventDefault();
            view.dispatch(view.state.tr.setMeta(commandListPluginKey, { close: true }));
            return true;
          }
          case "command-navigate": {
            event.preventDefault();
            composerStore.commandNavigateRef.current?.(action.direction);
            return true;
          }
          case "command-caret": {
            // Trap the caret inside the active token: clamp Left/Right to the
            // token range so it can't leave while the popup is open (Escape /
            // Dismiss is the only way out).
            event.preventDefault();
            if (commandState?.isOpen) {
              const { triggerStartPosition, triggerEndPosition } = commandState;
              const current = view.state.selection.from;
              const target = Math.min(
                Math.max(current + action.direction, triggerStartPosition),
                triggerEndPosition,
              );
              if (target !== current) {
                view.dispatch(
                  view.state.tr.setSelection(TextSelection.create(view.state.doc, target)),
                );
              }
            }
            return true;
          }
          case "ask-user-arrow": {
            event.preventDefault();
            const optionsHandle = composerStore.getSnapshot().askUser.optionsRef.current;
            optionsHandle?.navigate(action.direction);
            view.dom.blur();
            return true;
          }
          case "remove-last-attachment": {
            event.preventDefault();
            const { items, remove } = composerStore.getSnapshot().attachments;
            const lastItem = items.at(-1);
            if (lastItem) remove(lastItem.id);
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
      composerStore.getSnapshot().askUser.optionsRef.current?.clearHighlight();
    },
    onMount: ({ editor: instance }) => {
      editorRef.current = instance;
    },
    onUnmount: () => {
      editorRef.current = null;
    },
    onUpdate: ({ editor: instance }) => {
      const text = instance.getText();
      composerStore.setHasContent(text.trim().length > 0 || !instance.isEmpty);
      if (text.trim().length > 0) {
        clearSelectionsIfSingle();
        composerStore.getSnapshot().askUser.optionsRef.current?.clearHighlight();
      }
      onValueChangeRef.current?.(text);
      reportEditorUpdate(instance);
    },
    // Command state changes on selection and meta-only transactions too (caret
    // moving inside the token, Escape / Dismiss closing it), not just on doc
    // edits — so mirror it from onTransaction, which fires for every kind.
    // setCommands no-ops when nothing changed, so this stays cheap.
    onTransaction: ({ editor: instance }) => {
      const pluginState = commandListPluginKey.getState(instance.state);
      composerStore.setCommands({
        isOpen: pluginState?.isOpen ?? false,
        trigger: pluginState?.trigger ?? null,
        query: pluginState?.query ?? "",
      });
    },
    editable: !disabled,
    autofocus: autoFocus,
  });

  // setContent emits an update (tiptap v3 default), so onUpdate keeps
  // hasContent in sync — no manual write needed.
  useEffect(() => {
    if (isControlled && tiptapEditor && value !== tiptapEditor.getText()) {
      tiptapEditor.commands.setContent(value);
    }
  }, [value, tiptapEditor, isControlled]);

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
          {!hasContent && placeholder && (
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
  const isPanelOpen = useComposer((composer) => composer.panel.isOpen);
  const hasContent = Children.toArray(children).length > 0;
  // Yield to an open panel — the strip slides back out once it closes.
  const isVisible = hasContent && !isPanelOpen;
  return (
    <div
      data-slot="composer-context-window"
      className={cn(
        "relative z-0 overflow-hidden flex items-center transition-all duration-200 px-3 text-xs",
        // Background drawn by ::before so only the top corners round — the
        // bottom edge stays square and hides behind the container below.
        'before:content-[""] before:absolute before:inset-0 before:-z-10 before:rounded-t-2xl before:bg-base before:pointer-events-none',
        // Open: 32px visible band peeking above the container plus 16px
        // submerged beneath it (negative margin pulls the container up over
        // the bottom-padded zone).
        isVisible ? "h-12 pb-4 -mb-4 opacity-100" : "h-0 opacity-0",
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

type ComposerSubmitProps = ComponentProps<typeof IconButton> & {
  // While generating, the button morphs into a stop control: the send glyph
  // cross-fades to a stop square, the type flips to "button", and clicking it
  // (or pressing Escape) calls onStop instead of submitting the form.
  isGenerating?: boolean;
  onStop?: () => void;
};

const ComposerSubmit = ({
  children,
  className,
  disabled,
  isGenerating = false,
  onStop,
  onClick,
  ...props
}: ComposerSubmitProps) => {
  const hasContent = useComposer((composer) => composer.textarea.hasContent);
  const isSubmitting = useComposer((composer) => composer.isSubmitting);
  const attachments = useComposer((composer) => composer.attachments);

  // Esc aborts while generating — unless something already handled it (the
  // command-list closes on Esc and preventDefaults first, so it wins).
  const onStopRef = useAsRef(onStop);
  useEffect(() => {
    if (!isGenerating) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || event.defaultPrevented) return;
      event.preventDefault();
      onStopRef.current?.();
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isGenerating]);

  const autoDisabled =
    disabled ?? ((!hasContent && attachments.items.length === 0) || isSubmitting);

  return (
    <IconButton
      type={isGenerating ? "button" : "submit"}
      variant="accent"
      data-slot="composer-submit"
      data-generating={isGenerating ? "" : undefined}
      aria-label={isGenerating ? "Stop generating" : undefined}
      className={cn("rounded-full", className)}
      disabled={isGenerating ? false : autoDisabled}
      onClick={isGenerating ? () => onStop?.() : onClick}
      {...props}
    >
      <AnimatePresence mode="wait" initial={false}>
        <motion.span
          key={isGenerating ? "stop" : "send"}
          initial={{ opacity: 0, scale: 0.8, filter: "blur(4px)" }}
          animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
          exit={{ opacity: 0, scale: 0.8, filter: "blur(4px)" }}
          transition={{ duration: 0.15 }}
          className="flex items-center justify-center"
        >
          {isGenerating ? <StopIcon /> : (children ?? <SendIcon />)}
        </motion.span>
      </AnimatePresence>
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
  const isCommandListOpen = useComposer((composer) => composer.commands.isOpen);
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

  // Mirror the open panel into the store so sibling parts (the context
  // window) can yield while a panel is open and consumers can read which
  // panel is active.
  useEffect(() => {
    composerStore.setPanelValue(hasMatch ? (effectiveValue ?? null) : null);
    return () => composerStore.setPanelValue(null);
  }, [hasMatch, effectiveValue]);

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
  dismiss: () => void;
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
  const attachments = useComposer((composer) => composer.attachments);
  const internals = useComposerInternals();

  const isActive = useComposer(
    (composer) => composer.commands.isOpen && composer.commands.trigger === prefix,
  );
  const query = useComposer((composer) => composer.commands.query);

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
      const triggerEndPosition =
        pluginState?.triggerEndPosition ?? editor.state.selection.$from.pos;

      if (kind === "insert") {
        // Add a trailing space so the user can keep typing — unless one is
        // already there (mid-sentence mention), to avoid doubling it.
        const docEnd = editor.state.doc.content.size;
        const charAfter =
          triggerEndPosition < docEnd
            ? editor.state.doc.textBetween(triggerEndPosition, triggerEndPosition + 1)
            : "";
        const chain = editor
          .chain()
          .focus()
          .deleteRange({ from: triggerStartPosition, to: triggerEndPosition })
          .insertContentAt(triggerStartPosition, {
            type: "mentionChip",
            attrs: {
              prefix,
              label: dataItem.label ?? dataItem.value,
              value: dataItem.value,
              icon: dataItem.icon ?? null,
              variant: dataItem.variant ?? null,
            },
          });
        if (charAfter !== " ") chain.insertContent(" ");
        chain.run();
      } else {
        editor
          .chain()
          .focus()
          .deleteRange({ from: triggerStartPosition, to: triggerEndPosition })
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

  const dismiss = useCallback(() => {
    const editor = internals.editorRef.current;
    if (!editor) return;
    editor.view.focus();
    editor.view.dispatch(editor.state.tr.setMeta(commandListPluginKey, { close: true }));
  }, [internals]);

  if (isActive) {
    // With matches, select the highlight. With none, the "No results" row is
    // itself the (only) option and selecting it dismisses — so Tab/Enter aren't
    // dead in the empty state (Linear-style).
    composerStore.commandSelectRef.current = effectiveHighlight
      ? () => selectByValue(effectiveHighlight)
      : state === "empty"
        ? dismiss
        : null;
    composerStore.commandNavigateRef.current = (direction: number) => {
      const next = computeNextHighlight(items, effectiveHighlight, direction === -1 ? -1 : 1);
      setHighlightOverride(next);
    };
  }

  const navContext = useMemo<CommandListNavContextValue>(
    () => ({
      highlightedValue: effectiveHighlight,
      setHighlightedValue: setHighlightOverride,
      selectByValue,
      dismiss,
    }),
    [effectiveHighlight, selectByValue, dismiss],
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
      // Shown only when nothing matches, where it acts as the single highlighted
      // option whose selection dismisses — so it carries the highlight styling.
      "items-center gap-2 rounded-lg bg-primary-hover px-3 h-8 text-sm text-ink-primary",
      className,
    )}
    {...props}
  >
    {children ?? "No results found"}
  </div>
);

// Dismisses the active token (same as Escape): closes the popup, leaves the
// typed text in place, and keeps it dismissed until the prefix is retyped.
// preventDefault on mousedown so the click never steals focus from the editor.
const ComposerCommandDismiss = ({ className, children, ...props }: ComponentProps<"button">) => {
  const navContext = useContext(CommandListNavContext);
  if (!navContext) {
    throw new Error("<Composer.CommandDismiss> must be rendered inside <Composer.CommandList>.");
  }

  return (
    <button
      type="button"
      data-slot="composer-command-dismiss"
      className={cn("cursor-pointer text-ink-tertiary hover:text-ink-primary", className)}
      onMouseDown={(event) => {
        event.preventDefault();
        navContext.dismiss();
      }}
      {...props}
    >
      {children ?? "Dismiss"}
    </button>
  );
};

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
          <ComposerCommandEmpty>
            <span>No results found</span>
            <ComposerCommandDismiss />
          </ComposerCommandEmpty>
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
  const askUser = useComposer((composer) => composer.askUser);

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
          onValueChange={askUser.toggleOption}
        >
          {display.options.map((option) => (
            <AskUser.Option
              key={option.label}
              value={option.label}
              selected={entry.selected.has(option.label)}
              onSelect={() => askUser.toggleOption(option.label)}
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
  const askUser = useComposer((composer) => composer.askUser);
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
  const askUser = useComposer((composer) => composer.askUser);
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
  const askUser = useComposer((composer) => composer.askUser);
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
  CommandDismiss: ComposerCommandDismiss,
  CommandItem: ComposerCommandItem,
  CommandItemIcon: ComposerCommandItemIcon,
  CommandItemLabel: ComposerCommandItemLabel,
  CommandItemDescription: ComposerCommandItemDescription,
  CommandGroup: ComposerCommandGroup,
  CommandGroupLabel: ComposerCommandGroupLabel,
  CommandCollection: ComposerCommandCollection,
});
