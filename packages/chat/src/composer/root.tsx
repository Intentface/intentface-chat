"use client";

// Composer.Root — the form element that owns the submit flow, prop→store
// bridges, drag-drop scope, and the per-instance store resolution: an explicit
// Composer.createStore() handle via the store prop, or an instance created for
// this mount. Every bare <Composer> is fully isolated.

import type { Editor } from "@tiptap/react";
import { useEffect, useMemo, useRef, useSyncExternalStore } from "react";
import type { PrimitiveProps } from "../internal/primitive-props";
import { useRefWithInit } from "../internal/render/useRefWithInit";
import { useRenderElement } from "../internal/render/useRenderElement";
import {
  ComposerInternalsContext,
  type ComposerInternalsValue,
  useAsRef,
  useCommandRegistry,
  useComposerSnapshot,
  useDragDropFiles,
} from "./internals";
import { type ComposerStore, ComposerStoreContext, createComposerStore } from "./store";
import type {
  AskUserQuestion,
  ComposerCommandsMap,
  ComposerSnapshot,
  ComposerSubmitData,
} from "./types";

const EMPTY_COMMANDS: ComposerCommandsMap = {};

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
  /** Explicit Composer.createStore() handle; defaults to a per-mount instance. */
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
  // Resolved once at mount (lazy-init ref, not reactive state): an explicit
  // handle, or an instance this mount creates and owns. Swapping the store
  // prop after mount is not supported.
  const { store, ownsStore } = useRefWithInit(() => ({
    store: storeProp ?? createComposerStore(),
    ownsStore: !storeProp,
  })).current;

  const formRef = useRef<HTMLFormElement | null>(null);

  const onSubmitRef = useAsRef(onSubmit);

  // Register this mount on the store: answers submit through this mount's
  // onSubmit. Only a store this mount created gets reset on unmount — an
  // explicit handle's state belongs to its owner and survives remounts.
  useEffect(() => {
    store.submitAnswersRef.current = (answers) =>
      onSubmitRef.current?.({ kind: "answers", answers });
    return () => {
      store.submitAnswersRef.current = null;
      if (ownsStore) store.reset();
    };
  }, [store, ownsStore]);

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
    // Emit the generic attachment descriptors; the consumer's onSubmit adapts
    // them to its wire format (e.g. FilePart via prepareAttachmentsForSend).
    const files = attachments.items;

    store.resetAttachments();
    store.controller.clear();

    await onSubmitRef.current?.({
      kind: "message",
      text: submitText,
      files,
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
