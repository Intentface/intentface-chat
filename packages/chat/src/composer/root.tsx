"use client";

// Composer.Root — the form element that owns the submit flow, prop→store
// bridges, drag-drop scope, and the per-instance store resolution:
// props.store ?? nearest <Composer.Provider> ?? the page-global singleton.

import type { Editor } from "@tiptap/react";
import {
  type ReactNode,
  use,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import type { AttachmentItem } from "../attachments";
import { prepareAttachmentsForSend } from "../attachments";
import type { PrimitiveProps } from "../internal/primitive-props";
import { useRenderElement } from "../internal/render/useRenderElement";
import {
  ComposerInternalsContext,
  type ComposerInternalsValue,
  useAsRef,
  useCommandRegistry,
  useComposerSnapshot,
  useDragDropFiles,
} from "./internals";
import {
  type ComposerStore,
  ComposerStoreContext,
  createComposerStore,
  getGlobalComposerStore,
} from "./store";
import type {
  AskUserQuestion,
  ComposerCommandsMap,
  ComposerSnapshot,
  ComposerSubmitData,
} from "./types";

const EMPTY_COMMANDS: ComposerCommandsMap = {};

export type ComposerProviderProps = {
  store?: ComposerStore;
  children: ReactNode;
};

/**
 * Scopes a composer instance: everything inside resolves this store instead
 * of the page-global singleton. Multiple providers on one page (docs
 * previews) get fully isolated composers.
 */
export const ComposerProvider = ({ store, children }: ComposerProviderProps) => {
  const [instanceStore] = useState(() => store ?? createComposerStore());
  return <ComposerStoreContext value={instanceStore}>{children}</ComposerStoreContext>;
};

export type ComposerRootState = {
  /** Present as data-submitting while a submission is in flight. */
  submitting: boolean;
  /** Present as data-dragging while files are dragged over the drop scope. */
  dragging: boolean;
};

export type ComposerRootProps = Omit<PrimitiveProps<"form", ComposerRootState>, "onSubmit"> & {
  onSubmit?: (data: ComposerSubmitData) => void | Promise<void>;
  isSubmitting?: boolean;
  commands?: ComposerCommandsMap;
  questions?: AskUserQuestion[];
  defaultValue?: ComposerSnapshot;
  value?: ComposerSnapshot;
  onValueChange?: (snapshot: ComposerSnapshot) => void;
  /** Explicit store instance; defaults to the nearest provider, then the global. */
  store?: ComposerStore;
};

export const ComposerRoot = ({
  onSubmit,
  isSubmitting = false,
  commands = EMPTY_COMMANDS,
  questions,
  defaultValue,
  value,
  onValueChange,
  store: storeProp,
  className,
  render,
  style,
  ...elementProps
}: ComposerRootProps) => {
  const contextStore = use(ComposerStoreContext);
  const store = storeProp ?? contextStore ?? getGlobalComposerStore();

  const formRef = useRef<HTMLFormElement | null>(null);

  const onSubmitRef = useAsRef(onSubmit);

  // Register this mount on the resolved store: answers submit through this
  // mount's onSubmit, and unmounting resets all mount-scoped state so nothing
  // leaks across route changes.
  useEffect(() => {
    store.submitAnswersRef.current = (answers) =>
      onSubmitRef.current?.({ kind: "answers", answers });
    return () => {
      store.submitAnswersRef.current = null;
      store.reset();
    };
  }, [store]);

  // Prop → store bridges. Actions and refs on the snapshot are identity-stable,
  // so reading them here without subscribing is safe.
  const { add: addAttachments, globalDropRef } = store.getSnapshot().attachments;

  // Subscribed on the resolved store (not through useComposer — a `store` prop
  // may differ from the nearest context) to surface drag state as data-dragging.
  const getIsDragging = () => store.getSnapshot().attachments.isDragging;
  const isDragging = useSyncExternalStore(store.subscribe, getIsDragging, getIsDragging);

  useEffect(() => {
    store.setIsSubmitting(isSubmitting);
  }, [store, isSubmitting]);

  // Sync the questions prop into the store and arm ask-user mode (editor blur
  // + document-level keyboard handling) while questions are active.
  useEffect(() => {
    store.setQuestions(questions ?? null);
    if (!questions?.length) return;
    return store.activateAskUser();
  }, [store, questions]);

  const { getRegisteredPrefixes } = useCommandRegistry(commands);

  useDragDropFiles({
    rootRef: formRef,
    globalDropRef,
    onFiles: addAttachments,
    setDragging: store.setDragging,
  });

  const { reportEditorUpdate } = useComposerSnapshot({
    editorRef: store.editorRef as { current: Editor | null },
    defaultValue,
    value,
    onValueChange,
  });

  const handleFormSubmit = async (event: React.SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();
    const { askUser, attachments } = store.getSnapshot();

    if (askUser.questions?.length) {
      askUser.continueStep(store.controller.getText());
      return;
    }

    if (isSubmitting) return;

    const serialized = store.controller.serialize();
    const trimmedText = serialized.text.trim();
    if (!trimmedText && !attachments.items.length) return;

    const submitText = trimmedText || "Sent with attachments";
    const fileItems: AttachmentItem[] = attachments.items;
    const fileParts = fileItems.length > 0 ? await prepareAttachmentsForSend(fileItems) : [];

    store.resetAttachments();
    store.controller.clear();

    await onSubmitRef.current?.({
      kind: "message",
      text: submitText,
      files: fileParts,
    });
  };

  const internalsValue = useMemo<ComposerInternalsValue>(
    () => ({
      commands,
      getRegisteredPrefixes,
      reportEditorUpdate,
    }),
    [commands, getRegisteredPrefixes, reportEditorUpdate],
  );

  const formElement = useRenderElement(
    "form",
    { className, render, style },
    {
      state: { submitting: isSubmitting, dragging: isDragging },
      ref: formRef,
      props: [{ "data-slot": "composer-root", onSubmit: handleFormSubmit }, elementProps],
    },
  );

  return (
    <ComposerStoreContext value={store}>
      <ComposerInternalsContext value={internalsValue}>{formElement}</ComposerInternalsContext>
    </ComposerStoreContext>
  );
};
