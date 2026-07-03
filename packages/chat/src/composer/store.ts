"use client";

// Composer store — all reactive composer state in one store, so useComposer
// can offer Zustand-style selectors and components re-render only for the
// slice they read. Actions and refs are created once and survive every
// update; a slice's identity changes only when that slice's data changes.
//
// Instance model: Composer.Root provides a store via ComposerStoreContext; any
// hook resolves `nearest provider ?? lazy global singleton`. Zero-config
// single-composer pages keep the drive-from-anywhere ergonomics (the global
// instance), while multiple composers on one page each get their own store.
// SSR-safe by invariant: every write happens in an effect or event handler
// (client-only), so server renders only ever read the pristine snapshot.

import type { Editor } from "@tiptap/react";
import { createContext, type ReactNode, type RefObject, use, useSyncExternalStore } from "react";
import type { AskUserOptionsHandle } from "../ask-user";
import {
  type AttachmentItem,
  DEFAULT_ATTACHMENT_ACCEPT,
  DEFAULT_ATTACHMENT_MAX_FILE_SIZE,
  DEFAULT_ATTACHMENT_MAX_FILES,
} from "../attachments";
import type { AskUserQuestion } from "../types";
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
import type { ComposerAnswerEntry } from "./types";

// ---------------------------------------------------------------------------
// State slices
// ---------------------------------------------------------------------------

export type ComposerAttachmentsState = {
  items: AttachmentItem[];
  add: (files: File[] | FileList) => void;
  remove: (id: string) => void;
  openFileDialog: () => void;
  error: string | null;
  isDragging: boolean;
  fileInputRef: RefObject<HTMLInputElement | null>;
  globalDropRef: RefObject<boolean>;
};

export type ComposerAskUserState = {
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
export type ComposerCommandsState = {
  isOpen: boolean;
  trigger: string | null;
  query: string;
  highlightIndex: number;
  // items: ComposerCommandItem[];
};

// export type ComposerCommandItem = {
//   icon: ReactNode;
//   label: string;
//   value: string;
// };

// The effective open panel — `value` is the matched Composer.PanelItem value
// (including the "command-list" override), null while closed.
export type ComposerPanelState = {
  isOpen: boolean;
  value: string | null;
};

export type ComposerState = {
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
// Store
// ---------------------------------------------------------------------------

export type ComposerStore = {
  subscribe: (listener: () => void) => () => void;
  getSnapshot: () => ComposerState;
  // Bridges for props and editor/document integrations — not consumer API.
  setHasContent: (value: boolean) => void;
  setIsSubmitting: (value: boolean) => void;
  setPanelValue: (value: string | null) => void;
  setCommands: (next: { isOpen: boolean; trigger: string | null; query: string }) => void;
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

  const setCommands = (next: { isOpen: boolean; trigger: string | null; query: string }) => {
    const current = snapshot.commands;
    if (
      current.isOpen === next.isOpen &&
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
    panel: { isOpen: false, value: null },
    commands: { isOpen: false, trigger: null, query: "", highlightIndex: 0 },
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
    setPanelValue,
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
    attachmentConfigRef,
    submitAnswersRef,
    commandSelectRef,
  };
};

// ---------------------------------------------------------------------------
// Instance resolution — nearest provider, else the lazy global singleton.
// ---------------------------------------------------------------------------

export const ComposerStoreContext = createContext<ComposerStore | null>(null);

let globalComposerStore: ComposerStore | undefined;

export const getGlobalComposerStore = (): ComposerStore => {
  globalComposerStore ??= createComposerStore();
  return globalComposerStore;
};

export const useComposerStore = (): ComposerStore =>
  use(ComposerStoreContext) ?? getGlobalComposerStore();

// Subscribe to composer state — from anywhere; resolves the nearest
// Composer.Root's store, falling back to the page-global instance. With a
// selector, the component re-renders only when the selected value changes
// identity (slices are identity-stable):
//   const askUser = useComposer((composer) => composer.askUser);
// Without one, it returns the full snapshot and re-renders on any change.
export const useComposer = <Selected = ComposerState>(
  selector?: (composer: ComposerState) => Selected,
): Selected => {
  const store = useComposerStore();
  const getValue = () => {
    const state = store.getSnapshot();
    // Safe: without a selector, Selected defaults to ComposerState.
    return selector ? selector(state) : (state as Selected);
  };
  return useSyncExternalStore(store.subscribe, getValue, getValue);
};
