"use client";

// Composer store — all reactive composer state in one store, so useComposer
// can offer Zustand-style selectors and components re-render only for the
// slice they read. Actions and refs are created once and survive every
// update; a slice's identity changes only when that slice's data changes.
//
// Instance model: every Composer.Root owns a store (an explicit
// Composer.createStore() handle, or one created per mount) and provides it via
// ComposerStoreContext. Inside the tree, useComposer resolves it implicitly;
// outside, useComposerStore(store, selector) and store.controller take an
// explicit handle — no global fallback, so state is never read or driven by
// accident. SSR-safe by invariant: every write happens in an effect or event
// handler (client-only), so server renders only ever read the pristine
// snapshot.

import type { Editor } from "@tiptap/react";
import { createContext, type RefObject, use, useSyncExternalStore } from "react";
import type { AskUserOptionsHandle } from "../ask-user";
import {
  type AttachmentErrorCode,
  type AttachmentItem,
  revokeAttachmentUrl,
  toAttachmentItem,
} from "../attachments";
import {
  type AnswerEntry,
  type AskUserAction,
  type AskUserEffect,
  INITIAL_ASK_USER_STATE,
  isLastStep,
  transitionAskUser,
} from "./ask-user-machine";
import {
  type AttachmentStoreAction,
  type AttachmentStoreConfig,
  attachmentReducer,
  INITIAL_ATTACHMENT_STATE,
} from "./attachments-machine";
import { type ComposerEditorState, createEditorController } from "./document";
import { interpretAskUserKey } from "./keyboard";
import type { AskUserQuestion, ComposerAnswerEntry } from "./types";

// ---------------------------------------------------------------------------
// State slices
// ---------------------------------------------------------------------------

export type ComposerAttachmentsState = {
  items: AttachmentItem[];
  add: (files: File[] | FileList) => void;
  remove: (id: string) => void;
  openFileDialog: () => void;
  error: AttachmentErrorCode | null;
  isDragging: boolean;
  fileInputRef: RefObject<HTMLInputElement | null>;
  globalDropRef: RefObject<boolean>;
};

export type ComposerAskUserState = ComposerPanelSlice & {
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

// Command-list state: the plugin mirror (whether a trigger prefix is active,
// which one, the query typed after it) plus the navigation highlight. The
// highlight lives here — not in the CommandList component — so the editor's
// keydown handler (outside React) can move it through a plain store method
// instead of a bridged ref. It's a raw index; readers wrap it by item count.
// Every native panel slice (commands, ask-user, and later tool-approval) shares
// this skeleton, so a consumer can gate any of them the same way
// (`{commands.active && <…/>}`); each adds its own payload/actions on top.
export type ComposerPanelSlice = { active: boolean };

// Command-list state: the plugin mirror (which trigger prefix is active, the query
// typed after it) plus the navigation highlight. The highlight lives here — not in
// the CommandList component — so the editor's keydown handler (outside React) can
// move it through a plain store method. Raw index; readers wrap it by item count.
export type ComposerCommandsState = ComposerPanelSlice & {
  trigger: string | null;
  query: string;
  highlightIndex: number;
};

export type ComposerState = {
  // The editor controller methods (stable identities) plus the reactive
  // hasContent flag: const textarea = useComposer((c) => c.textarea)
  textarea: ComposerEditorState & { hasContent: boolean };
  isSubmitting: boolean;
  commands: ComposerCommandsState;
  attachments: ComposerAttachmentsState;
  askUser: ComposerAskUserState;
};

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

export type ComposerStore = {
  subscribe: (listener: () => void) => () => void;
  getSnapshot: () => ComposerState;
  // Bridges for props and editor/document integrations — not consumer API.
  setHasContent: (value: boolean) => void;
  setIsSubmitting: (value: boolean) => void;
  setCommands: (next: { active: boolean; trigger: string | null; query: string }) => void;
  moveHighlight: (direction: number) => void;
  setHighlight: (index: number) => void;
  setQuestions: (questions: AskUserQuestion[] | null) => void;
  setDragging: (active: boolean) => void;
  resetAttachments: () => void;
  activateAskUser: () => () => void;
  reset: () => void;
  // The store's editor instance: registered by the mounted Textarea, driven
  // through the controller (a null-safe port over editorRef).
  editorRef: RefObject<Editor | null>;
  controller: ComposerEditorState;
  registerEditor: (editor: Editor) => () => void;
  // The mounted Composer.Container's element, registered by its render ref.
  // Composer.Popover anchors to the active command badge inside the editor, but
  // observes this box to reposition — the badge moves when the container grows
  // (attachments strip, multi-line input).
  containerRef: RefObject<HTMLElement | null>;
  // Co-located refs the mounted Composer wires up at runtime.
  attachmentConfigRef: RefObject<AttachmentStoreConfig>;
  submitAnswersRef: RefObject<((answers: ComposerAnswerEntry[]) => void) | null>;
  // Invokes the active list's current selection. Registered by the mounted
  // CommandList via a callback ref (commit-time), not an effect.
  commandSelectRef: RefObject<(() => void) | null>;
};

export const createComposerStore = (): ComposerStore => {
  const listeners = new Set<() => void>();
  const notify = () => {
    for (const listener of listeners) listener();
  };

  // Per-store editor instance behind a null-safe controller.
  const editorRef: RefObject<Editor | null> = { current: null };
  const controller = createEditorController(editorRef);
  const registerEditor = (editor: Editor) => {
    editorRef.current = editor;
    return () => {
      if (editorRef.current === editor) editorRef.current = null;
    };
  };

  // Imperative refs co-located with the store; not reactive.
  const containerRef: RefObject<HTMLElement | null> = { current: null };
  const optionsRef: RefObject<AskUserOptionsHandle | null> = { current: null };
  const fileInputRef: RefObject<HTMLInputElement | null> = { current: null };
  const globalDropRef: RefObject<boolean> = { current: false };
  // Permissive defaults: accept everything, no caps, platform-default blob
  // ingestion. Composer.Attachments overwrites this with the consumer's
  // policy and any custom convert/destroy.
  const attachmentConfigRef: RefObject<AttachmentStoreConfig> = {
    current: {
      accept: "",
      maxFiles: Number.POSITIVE_INFINITY,
      maxFileSize: Number.POSITIVE_INFINITY,
      convert: toAttachmentItem,
      destroy: revokeAttachmentUrl,
    },
  };
  const submitAnswersRef: RefObject<((answers: ComposerAnswerEntry[]) => void) | null> = {
    current: null,
  };
  const commandSelectRef: RefObject<(() => void) | null> = { current: null };

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

  const setCommands = (next: { active: boolean; trigger: string | null; query: string }) => {
    const current = snapshot.commands;
    if (
      current.active === next.active &&
      current.trigger === next.trigger &&
      current.query === next.query
    ) {
      return;
    }
    // Re-point the highlight at the first row whenever the active token or its
    // query changes, so filtering always lands on the top match.
    const resetHighlight = current.trigger !== next.trigger || current.query !== next.query;
    snapshot = {
      ...snapshot,
      commands: { ...next, highlightIndex: resetHighlight ? 0 : current.highlightIndex },
    };
    notify();
  };

  // Move the highlight by ±1 (raw, unbounded). The active CommandList wraps it
  // by its item count when reading, so the store needs no item knowledge.
  const moveHighlight = (direction: number) => {
    const { commands } = snapshot;
    snapshot = {
      ...snapshot,
      commands: { ...commands, highlightIndex: commands.highlightIndex + direction },
    };
    notify();
  };

  // Set the highlight to an absolute index (hover).
  const setHighlight = (index: number) => {
    if (snapshot.commands.highlightIndex === index) return;
    snapshot = { ...snapshot, commands: { ...snapshot.commands, highlightIndex: index } };
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
          controller.clear();
          break;
        case "set-input-text":
          controller.setText(effect.text);
          break;
        case "focus-input":
          controller.focus();
          break;
        case "blur-input":
          controller.blur();
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
        active: questions != null,
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
    controller.blur();

    const handleKeyDown = (event: KeyboardEvent) => {
      // This is a document-level listener, so scope it to this composer:
      // ignore keystrokes aimed at another editable (e.g. a second composer on
      // the same page). Options/body focus (no editable host) still counts as
      // ours, so the "type to answer" path keeps working.
      const target = event.target as HTMLElement | null;
      const editableHost = target?.closest<HTMLElement>(
        'input, textarea, [contenteditable="true"]',
      );
      if (editableHost && editableHost !== editorRef.current?.view.dom) return;

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
          if (newValue === null) controller.focus();
          return;
        }
        case "select-option": {
          const item = optionsHandle?.select();
          if (item) dispatchAskUser({ type: "select-option", label: item.value });
          return;
        }
        case "go-back":
          dispatchAskUser({ type: "step-back", currentText: controller.getText() });
          return;
        case "go-next":
          dispatchAskUser({ type: "step-forward", currentText: controller.getText() });
          return;
        case "insert-character":
          optionsHandle?.clearHighlight();
          controller.focus();
          controller.insertText(action.character);
          return;
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  };

  snapshot = {
    textarea: { ...controller, hasContent: false },
    isSubmitting: false,
    commands: { active: false, trigger: null, query: "", highlightIndex: 0 },
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
      active: false,
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
      goBack: () => dispatchAskUser({ type: "step-back", currentText: controller.getText() }),
      goNext: () => dispatchAskUser({ type: "step-forward", currentText: controller.getText() }),
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
    setCommands,
    moveHighlight,
    setHighlight,
    setQuestions,
    setDragging,
    resetAttachments: () => dispatchAttachments({ type: "reset" }),
    activateAskUser,
    reset,
    editorRef,
    controller,
    registerEditor,
    containerRef,
    attachmentConfigRef,
    submitAnswersRef,
    commandSelectRef,
  };
};

// ---------------------------------------------------------------------------
// Instance resolution — the nearest <Composer>, explicitly. No global
// fallback: outside a composer tree, state comes from an explicit
// Composer.createStore() handle via useComposerStore.
// ---------------------------------------------------------------------------

export const ComposerStoreContext = createContext<ComposerStore | null>(null);

// Internal: parts resolve the store their Composer.Root provided.
export const useComposerContextStore = (): ComposerStore => {
  const store = use(ComposerStoreContext);
  if (!store) {
    throw new Error("Composer components must be used within <Composer>");
  }
  return store;
};

// Subscribe to an explicit Composer.createStore() instance — the
// outside-the-tree twin of useComposer (toolbars, status bars, shortcut
// handlers). Wrap it once per instance to drop the store argument at call
// sites:
//   const useChatComposer = <T,>(selector: (c: ComposerState) => T) =>
//     useComposerStore(chatComposerStore, selector);
export const useComposerStore = <Selected = ComposerState>(
  store: ComposerStore,
  selector?: (composer: ComposerState) => Selected,
): Selected => {
  const getValue = () => {
    const state = store.getSnapshot();
    // Safe: without a selector, Selected defaults to ComposerState.
    return selector ? selector(state) : (state as Selected);
  };
  return useSyncExternalStore(store.subscribe, getValue, getValue);
};

// Subscribe to composer state from inside the tree. With a selector, the
// component re-renders only when the selected value changes identity (slices
// are identity-stable):
//   const askUser = useComposer((composer) => composer.askUser);
// Without one, it returns the full snapshot and re-renders on any change.
export const useComposer = <Selected = ComposerState>(
  selector?: (composer: ComposerState) => Selected,
): Selected => useComposerStore(useComposerContextStore(), selector);
