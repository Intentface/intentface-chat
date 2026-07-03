"use client";

// Composer.Root — the form element that owns the submit flow, prop→store
// bridges, drag-drop scope, and the per-instance store resolution:
// props.store ?? nearest <Composer.Provider> ?? the page-global singleton.

import type { Editor } from "@tiptap/react";
import {
  type ComponentProps,
  type ReactNode,
  use,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { AttachmentItem } from "../attachments";
import { prepareAttachmentsForSend } from "../attachments";
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
const EMPTY_CHIP_ICONS: Record<string, ReactNode> = {};

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

export type ComposerRootProps = Omit<ComponentProps<"form">, "onSubmit" | "ref"> & {
  onSubmit?: (data: ComposerSubmitData) => void | Promise<void>;
  isSubmitting?: boolean;
  commands?: ComposerCommandsMap;
  questions?: AskUserQuestion[];
  defaultValue?: ComposerSnapshot;
  value?: ComposerSnapshot;
  onValueChange?: (snapshot: ComposerSnapshot) => void;
  /** Explicit store instance; defaults to the nearest provider, then the global. */
  store?: ComposerStore;
  /** Icon map for chip icon keys, threaded into the mention-chip node view. */
  chipIcons?: Record<string, ReactNode>;
};

export const ComposerRoot = ({
  children,
  onSubmit,
  isSubmitting = false,
  commands = EMPTY_COMMANDS,
  questions,
  defaultValue,
  value,
  onValueChange,
  store: storeProp,
  chipIcons = EMPTY_CHIP_ICONS,
  ...formProps
}: ComposerRootProps) => {
  const contextStore = use(ComposerStoreContext);
  const store = storeProp ?? contextStore ?? getGlobalComposerStore();

  const formRef = useRef<HTMLFormElement | null>(null);

  const onSubmitRef = useAsRef(onSubmit);
  const chipIconsRef = useAsRef(chipIcons);

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
      chipIconsRef,
    }),
    [commands, getRegisteredPrefixes, reportEditorUpdate, chipIconsRef],
  );

  return (
    <ComposerStoreContext value={store}>
      <ComposerInternalsContext value={internalsValue}>
        <form data-slot="composer-root" onSubmit={handleFormSubmit} ref={formRef} {...formProps}>
          {children}
        </form>
      </ComposerInternalsContext>
    </ComposerStoreContext>
  );
};
