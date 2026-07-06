"use client";

// Component-wiring shared by the composer parts: the internals context
// (command registry, editor-update reporting) and the small hooks the parts
// build on. Not consumer API.

import type { Editor } from "@tiptap/react";
import {
  createContext,
  type RefObject,
  use,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
} from "react";
import { createDragHandlers } from "./attachments-machine";
import { applySnapshotToEditor, snapshotFromEditor } from "./document";
import type { RegisteredPrefix } from "./prefix-plugin";
import type { ComposerCommandsMap, ComposerSnapshot } from "./types";

// SSR-safe layout effect — same shape as cmdk's. useLayoutEffect runs before
// paint; useEffect is a no-op fallback when window is undefined (SSR pass).
export const useIsomorphicLayoutEffect =
  typeof window === "undefined" ? useEffect : useLayoutEffect;

// Mirror a prop into a ref so closures always see the latest value without
// having to add the prop to dep arrays. Layout effect ensures `.current` is
// updated before any sibling layout effect or sync user event observes it.
export const useAsRef = <T,>(value: T) => {
  const ref = useRef(value);
  useIsomorphicLayoutEffect(() => {
    ref.current = value;
  });
  return ref;
};

export type ComposerInternalsValue = {
  commands: ComposerCommandsMap;
  getRegisteredPrefixes: () => RegisteredPrefix[];
  reportEditorUpdate: (editor: Editor) => void;
};

export const ComposerInternalsContext = createContext<ComposerInternalsValue | null>(null);

export const useComposerInternals = (): ComposerInternalsValue => {
  const context = use(ComposerInternalsContext);
  if (!context) {
    throw new Error("useComposerInternals must be called inside a <Composer> subtree.");
  }
  return context;
};

export const useCommandRegistry = (commands: ComposerCommandsMap) => {
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

export const useDragDropFiles = ({
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

export const useComposerSnapshot = ({
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
