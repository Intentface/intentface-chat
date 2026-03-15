"use client";

import Document from "@tiptap/extension-document";
import Paragraph from "@tiptap/extension-paragraph";
import Text from "@tiptap/extension-text";
import { type Editor, EditorContent, useEditor } from "@tiptap/react";
import type { FileUIPart } from "ai";
import { AnimatePresence, motion } from "motion/react";
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
import { SendIcon } from "@/components/icons/send";
import { IconButton } from "@/components/ui/icon-button";
import { useLoop } from "@/hooks/use-loop";
import { cn } from "@/lib/utils";

// Types
type AttachmentsApi = {
  add: (files: File[] | FileList) => void;
  remove: (id: string) => void;
  openFileDialog: () => void;
};

type ComposerContextValue = {
  editorRef: RefObject<Editor | null>;
  attachmentsApi: RefObject<AttachmentsApi | null>;
  isDragging: boolean;
  isSubmitting: boolean;
  hasContent: boolean;
  setHasContent: (has: boolean) => void;
  attachments: AttachmentItem[];
  setAttachments: React.Dispatch<React.SetStateAction<AttachmentItem[]>>;
  attachmentRef: RefObject<AttachmentItem[]>;
  attachmentError: string | null;
  setAttachmentError: (error: string | null) => void;
  globalDropRef: RefObject<boolean>;
  webSearch: boolean;
  setWebSearch: (value: boolean) => void;
  thinking: boolean;
  setThinking: (value: boolean) => void;
};

const ComposerContext = createContext<ComposerContextValue>({
  editorRef: { current: null },
  attachmentsApi: { current: null },
  isDragging: false,
  isSubmitting: false,
  hasContent: false,
  setHasContent: () => {},
  attachments: [],
  setAttachments: () => {},
  attachmentRef: { current: [] },
  attachmentError: null,
  setAttachmentError: () => {},
  globalDropRef: { current: false },
  webSearch: false,
  setWebSearch: () => {},
  thinking: true,
  setThinking: () => {},
});

export const useComposer = () => useContext(ComposerContext);

// Drag handler factory — always on document, scope-checked at event time
const createDragHandlers = (
  api: RefObject<AttachmentsApi | null>,
  counter: { current: number },
  setDragging: (v: boolean) => void,
  isInScope: (e: DragEvent) => boolean,
) => ({
  onDragOver: (e: Event) => {
    if (!api.current) return;
    const event = e as DragEvent;
    if (!isInScope(event)) return;
    if (event.dataTransfer?.types?.includes("Files")) event.preventDefault();
  },
  onDragEnter: (e: Event) => {
    if (!api.current) return;
    const event = e as DragEvent;
    if (!isInScope(event)) return;
    if (event.dataTransfer?.types?.includes("Files")) {
      counter.current++;
      setDragging(true);
    }
  },
  onDragLeave: (e: Event) => {
    if (!api.current) return;
    const event = e as DragEvent;
    if (!isInScope(event)) return;
    counter.current--;
    if (counter.current === 0) setDragging(false);
  },
  onDrop: (e: Event) => {
    if (!api.current) return;
    const event = e as DragEvent;
    if (!isInScope(event)) return;
    if (event.dataTransfer?.types?.includes("Files")) event.preventDefault();
    counter.current = 0;
    setDragging(false);
    if (event.dataTransfer?.files && event.dataTransfer.files.length > 0) {
      api.current.add(event.dataTransfer.files);
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
};

const ComposerRoot = ({
  children,
  className,
  onSubmit,
  isSubmitting = false,
  ...formProps
}: ComposerRootProps) => {
  const editorRef = useRef<Editor | null>(null);
  const attachmentsApi = useRef<AttachmentsApi | null>(null);
  const rootRef = useRef<HTMLFormElement | null>(null);
  const globalDropRef = useRef(false);
  const dragCounter = useRef(0);

  const [isDragging, setIsDragging] = useState(false);
  const [hasContent, setHasContent] = useState(false);
  const [attachments, setAttachments] = useState<AttachmentItem[]>([]);
  const attachmentRef = useRef<AttachmentItem[]>(attachments);
  const [attachmentError, setAttachmentError] = useState<string | null>(null);
  const [webSearch, setWebSearch] = useState(false);
  const [thinking, setThinking] = useState(true);
  attachmentRef.current = attachments;

  const handleFormSubmit = async (e: React.SubmitEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (isSubmitting) return;

    const text = editorRef.current?.getText()?.trim() ?? "";
    if (!text && !attachments.length) return;

    const submitText = text || "Sent with attachments";
    const files =
      attachments.length > 0
        ? await prepareAttachmentsForSend(attachments)
        : [];

    revokeAllAttachmentUrls(attachments);
    setAttachments([]);
    editorRef.current?.commands.setContent("");
    setHasContent(false);

    await onSubmit?.({ text: submitText, files, webSearch, thinking });
  };

  // Drag handlers — always on document, scope-checked at event time via refs
  useEffect(() => {
    const isInScope = (e: DragEvent) =>
      globalDropRef.current ||
      (rootRef.current?.contains(e.target as Node) ?? false);

    const { onDragOver, onDragEnter, onDragLeave, onDrop } = createDragHandlers(
      attachmentsApi,
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

  const contextValue = useMemo(
    () => ({
      editorRef,
      attachmentsApi,
      isDragging,
      isSubmitting,
      hasContent,
      setHasContent,
      attachments,
      attachmentRef,
      setAttachments,
      attachmentError,
      setAttachmentError,
      globalDropRef,
      webSearch,
      setWebSearch,
      thinking,
      setThinking,
    }),
    [
      isDragging,
      isSubmitting,
      hasContent,
      attachments,
      attachmentError,
      webSearch,
      thinking,
    ],
  );

  return (
    <ComposerContext.Provider value={contextValue}>
      <form
        onSubmit={handleFormSubmit}
        ref={rootRef}
        className={cn("relative w-full", className)}
        {...formProps}
      >
        {children}
      </form>
    </ComposerContext.Provider>
  );
};

// Container — visual container with border/bg/rounded, click-to-focus
type ComposerContainerProps = ComponentProps<"div">;

const ComposerContainer = ({ className, children, ...props }: ComposerContainerProps) => {
  const { editorRef } = useContext(ComposerContext);

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
    const editor = editorRef.current;
    if (editor && !editor.isFocused) {
      editor.commands.focus();
    }
  };

  return (
    <div
      role="button"
      tabIndex={0}
      data-slot="composer-container"
      onMouseDown={handleMouseDown}
      className={cn(
        "border border-slate-6 bg-slate-1 rounded-4xl shadow-xs [corner-shape:squircle] cursor-text",
        "transition-colors",
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
};

// Attachments — self-registering leaf, internal state
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
  const {
    attachmentsApi,
    isDragging,
    attachments,
    attachmentRef,
    setAttachments,
    setAttachmentError,
    globalDropRef,
  } = useContext(ComposerContext);

  globalDropRef.current = globalDrop;

  // Callbacks — stable deps (functional setAttachments + primitive config).
  // attachmentRef.current is intentionally read at call time, not a reactive dep.
  // biome-ignore lint/correctness/useExhaustiveDependencies: itemsRef is a stable ref read at call time
  const add = useCallback(
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
      setAttachments((prev) => [...prev, ...capped.map(toAttachmentItem)]);
    },
    [accept, maxFiles, maxFileSize, setAttachmentError, setAttachments],
  );

  // biome-ignore lint/correctness/useExhaustiveDependencies: itemsRef is a stable ref read at call time
  const remove = useCallback(
    (id: string) => {
      const found = attachmentRef.current.find((item) => item.id === id);
      if (found) revokeAttachmentUrl(found);
      setAttachments((prev) => prev.filter((item) => item.id !== id));
      setAttachmentError(null);
    },
    [setAttachmentError, setAttachments],
  );

  // Callback ref: register API when input mounts, cleanup on unmount.
  // Re-runs only when add/remove change (config prop changes).
  // biome-ignore lint/correctness/useExhaustiveDependencies: attachmentsApi/itemsRef are stable refs
  const inputCallbackRef = useCallback(
    (node: HTMLInputElement | null) => {
      if (!node) return;
      attachmentsApi.current = {
        add,
        remove,
        openFileDialog: () => node.click(),
      };
      return () => {
        attachmentsApi.current = null;
        revokeAllAttachmentUrls(attachmentRef.current);
      };
    },
    [add, remove],
  );

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    if (event.currentTarget.files) {
      add(event.currentTarget.files);
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
        ref={inputCallbackRef}
        type="file"
      />

      {/* Attachments container with dropzone overlay */}
      <AnimatePresence initial={false}>
        {(isDragging || attachments.length > 0) && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className="overflow-hidden"
          >
            <div className="relative">
              {attachments.length > 0 ? (
                <div className={cn("flex flex-wrap gap-2 p-2", className)}>
                  <AnimatePresence initial={false}>
                    {attachments.map((attachmentsApi) => (
                      <Attachments.Item
                        key={attachmentsApi.id}
                        item={attachmentsApi}
                      >
                        <Attachments.Remove
                          onRemove={() => remove(attachmentsApi.id)}
                        />
                      </Attachments.Item>
                    ))}
                  </AnimatePresence>
                </div>
              ) : (
                <div className="h-14" />
              )}
              <Attachments.Dropzone visible={isDragging} variant="inline" />
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
  const { editorRef, attachmentsApi, attachmentRef, setHasContent } =
    useContext(ComposerContext);

  const isControlled = value !== undefined;

  // Ref-ify to prevent stale closure in TipTap's onUpdate
  const onValueChangeRef = useRef(onValueChange);
  onValueChangeRef.current = onValueChange;

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [Document, Paragraph, Text],
    content: isControlled ? value : "",
    editorProps: {
      attributes: {
        class: cn("max-w-none focus:outline-none w-full"),
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
        attachmentsApi.current?.add(files);
        return true;
      },
      handleKeyDown: (view, event) => {
        if (event.key === "Backspace" && view.state.doc.textContent === "") {
          const lastItem = attachmentRef.current.at(-1);
          if (lastItem) {
            event.preventDefault();
            attachmentsApi.current?.remove(lastItem.id);
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
    onMount: ({ editor }) => {
      editorRef.current = editor;
    },
    onUnmount: () => {
      editorRef.current = null;
    },
    onUpdate: ({ editor }) => {
      const text = editor.getText();
      setHasContent(text.trim().length > 0);
      onValueChangeRef.current?.(text);
    },
    editable: !disabled,
    autofocus: autoFocus,
  });

  // Sync controlled value
  useEffect(() => {
    if (isControlled && editor && value !== editor.getText()) {
      editor.commands.setContent(value);
      setHasContent(value.trim().length > 0);
    }
  }, [value, editor, isControlled, setHasContent]);

  const placeholder = useMemo(() => {
    return Children.toArray(children).find(
      (child) => isValidElement(child) && child.type === ComposerPlaceholder,
    );
  }, [children]);

  return (
    <div
      data-slot="composer-textarea"
      className={cn(
        "max-h-32 min-h-8 overflow-y-auto px-3 py-2 text-md",
        "mask-[linear-gradient(to_bottom,transparent,black_16px,black_calc(100%-16px),transparent)]",
        disabled && "opacity-50 cursor-not-allowed",
        className,
      )}
    >
      {editor !== null ? (
        <EditorContent editor={editor} className="relative">
          {editor.isEmpty && placeholder && (
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
    return <div className={cn("text-slate-10", className)}>{content}</div>;
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
          className={cn("text-slate-10", className)}
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
  <div className={cn("flex justify-end p-2", className)} {...props} />
);

// AttachmentTrigger — reads attachmentsApi from context
type ComposerAttachmentTriggerProps = ComponentProps<typeof IconButton>;

const ComposerAttachmentTrigger = (props: ComposerAttachmentTriggerProps) => {
  const { attachmentsApi } = useContext(ComposerContext);

  const handleClick = useCallback(() => {
    attachmentsApi.current?.openFileDialog();
  }, [attachmentsApi]);

  return (
    <Attachments.Trigger onClick={handleClick} {...props}></Attachments.Trigger>
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
  const { hasContent, attachments, isSubmitting } = useContext(ComposerContext);

  const autoDisabled =
    disabled ?? ((!hasContent && attachments.length === 0) || isSubmitting);

  return (
    <IconButton
      type="submit"
      variant="outline"
      className={cn("rounded-full", className)}
      disabled={autoDisabled}
      {...props}
    >
      {children ?? <SendIcon />}
    </IconButton>
  );
};

// State — morphing container that collapses when empty
type ComposerStatesProps = ComponentProps<"div">;

const ComposerStates = ({
  children,
  className,
  ...props
}: ComposerStatesProps) => {
  const hasChildren = Children.toArray(children).some(isValidElement);

  return (
    <div data-slot="composer-state" className={className} {...props}>
      <AnimatePresence initial={false}>
        {hasChildren && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ type: "spring", stiffness: 500, damping: 35 }}
            className="overflow-hidden"
          >
            <AnimatePresence mode="popLayout" initial={false}>
              {children}
            </AnimatePresence>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

// StateItem — crossfade wrapper for content inside Composer.State
type ComposerStateProps = {
  children: ReactNode;
} & ComponentProps<typeof motion.div>;

const stateItemTransition = { duration: 0.2, ease: "easeOut" as const };

const ComposerState = ({ children, ...props }: ComposerStateProps) => (
  <motion.div
    initial={{ opacity: 0, y: 4, filter: "blur(4px)" }}
    animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
    exit={{ opacity: 0, y: -4, filter: "blur(4px)" }}
    transition={stateItemTransition}
    {...props}
  >
    {children}
  </motion.div>
);

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
});
