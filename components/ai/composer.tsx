"use client";

import Document from "@tiptap/extension-document";
import Paragraph from "@tiptap/extension-paragraph";
import Text from "@tiptap/extension-text";
import { type Editor, EditorContent, useEditor } from "@tiptap/react";
import type { FileUIPart } from "ai";
import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
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
import { SendIcon } from "@/components/icons/send";
import Button from "@/components/ui/button";
import { IconButton } from "@/components/ui/icon-button";
import { useLoop } from "@/hooks/use-loop";
import { useMeasure } from "@/hooks/use-measure";
import { cn } from "@/lib/utils";
import type { AskUserQuestion } from "@/tools/ask-user";

// Types
type AttachmentsApi = {
  add: (files: File[] | FileList) => void;
  remove: (id: string) => void;
  openFileDialog: () => void;
};

type AnswerEntry = { selected: Set<string>; freeText: string };

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
  questions: AskUserQuestion[] | null;
  questionnaireStep: number;
  questionnaireAnswers: Map<number, AnswerEntry>;
  toggleQuestionOption: (
    step: number,
    label: string,
    multiSelect: boolean,
  ) => void;
  continueStep: (freeText?: string) => void;
  dismissStep: () => void;
  isLastQuestionStep: boolean;
  isSingleQuestion: boolean;
  goBack: () => void;
  goNext: () => void;
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
  questions: null,
  questionnaireStep: 0,
  questionnaireAnswers: new Map(),
  toggleQuestionOption: () => {},
  continueStep: () => {},
  dismissStep: () => {},
  isLastQuestionStep: false,
  isSingleQuestion: false,
  goBack: () => {},
  goNext: () => {},
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
  questions?: AskUserQuestion[];
  onQuestionsDone?: (answers: Record<string, string>) => void;
};

const ComposerRoot = ({
  children,
  className,
  onSubmit,
  isSubmitting = false,
  questions,
  onQuestionsDone,
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

  // Questionnaire state — reset when questions identity changes
  const prevQuestionsRef = useRef(questions);
  const [questionnaireStep, setQuestionnaireStep] = useState(0);
  const [questionnaireAnswers, setQuestionnaireAnswers] = useState<
    Map<number, AnswerEntry>
  >(() => new Map());
  if (prevQuestionsRef.current !== questions) {
    prevQuestionsRef.current = questions;
    setQuestionnaireStep(0);
    setQuestionnaireAnswers(new Map());
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
        next.set(step, { selected: newSelected, freeText: "" });
        return next;
      });
      editorRef.current?.commands.setContent("");
      setHasContent(false);
    },
    [],
  );

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

      if (questionnaireStep < questions.length - 1) {
        setQuestionnaireStep((s) => s + 1);
        editorRef.current?.commands.setContent("");
        setHasContent(false);
      } else {
        onQuestionsDone?.(compileAnswers(updatedAnswers));
      }
    },
    [questions, questionnaireStep, onQuestionsDone, compileAnswers],
  );

  const dismissStep = useCallback(() => {
    if (!questions?.length) return;

    editorRef.current?.commands.setContent("");
    setHasContent(false);

    const updatedAnswers = new Map(answersRef.current);
    updatedAnswers.delete(questionnaireStep);
    setQuestionnaireAnswers(updatedAnswers);

    if (questionnaireStep < questions.length - 1) {
      setQuestionnaireStep((s) => s + 1);
    } else {
      onQuestionsDone?.(compileAnswers(updatedAnswers));
    }
  }, [questions, questionnaireStep, onQuestionsDone, compileAnswers]);

  const goBackStep = useCallback(() => {
    setQuestionnaireStep((s) => Math.max(0, s - 1));
    editorRef.current?.commands.setContent("");
    setHasContent(false);
  }, []);

  const goNextStep = useCallback(() => {
    if (!questions) return;
    setQuestionnaireStep((s) => Math.min(questions.length - 1, s + 1));
    editorRef.current?.commands.setContent("");
    setHasContent(false);
  }, [questions]);

  const handleFormSubmit = async (e: React.SubmitEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (questions?.length) {
      const text = editorRef.current?.getText()?.trim() ?? "";
      editorRef.current?.commands.setContent("");
      setHasContent(false);
      continueStep(text);
      return;
    }

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

  // ESC handler for questionnaire
  useEffect(() => {
    if (!questions?.length) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        dismissStep();
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [questions, dismissStep]);

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
      questions: questions ?? null,
      questionnaireStep: questionnaireStep,
      questionnaireAnswers: questionnaireAnswers,
      toggleQuestionOption,
      continueStep,
      dismissStep,
      isLastQuestionStep,
      isSingleQuestion,
      goBack: goBackStep,
      goNext: goNextStep,
    }),
    [
      isDragging,
      isSubmitting,
      hasContent,
      attachments,
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
      goBackStep,
      goNextStep,
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
  const [ref, bounds] = useMeasure();
  const hasChildren = Children.toArray(children).some(isValidElement);

  // Hold last non-zero height so the panel doesn't collapse to 0
  // during the AnimatePresence mode="wait" gap between exit and enter.
  const lastHeightRef = useRef(0);
  if (bounds.height > 0) lastHeightRef.current = bounds.height;

  return (
    <div
      data-slot="composer-state"
      className={cn("overflow-hidden", hasChildren && "pb-2", className)}
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
          {hasChildren && (
            <motion.div
              initial={{ y: "100%", opacity: 0 }}
              animate={{
                y: 0,
                opacity: 1,
                height: bounds.height,
              }}
              exit={{ y: "100%", opacity: 0 }}
              className="overflow-hidden border border-slate-6 bg-slate-1 rounded-4xl shadow-xs [corner-shape:squircle]"
            >
              <div ref={ref} className="relative">
                <AnimatePresence mode="popLayout" initial={false}>
                  {children}
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
  children: ReactNode;
} & ComponentProps<typeof motion.div>;

const ComposerState = ({ children, ...props }: ComposerStateProps) => (
  <motion.div
    initial={{ opacity: 0, filter: "blur(8px)" }}
    animate={{ opacity: 1, filter: "blur(0px)" }}
    exit={{ opacity: 0, filter: "blur(8px)" }}
    {...props}
  >
    {children}
  </motion.div>
);

// Questionnaire — self-contained, reads from ComposerContext.
// Holds a snapshot of questions so it can still render during exit animations
// (the parent unmounts this via AnimatePresence, but context clears first).
const ComposerQuestionnaire = () => {
  const {
    questions,
    questionnaireStep,
    questionnaireAnswers,
    toggleQuestionOption,
    isSingleQuestion,
    goBack,
    goNext,
  } = useContext(ComposerContext);

  // Hold last valid question so content stays rendered during exit animations.
  // The parent controls mount/unmount — if we're in the tree, we render.
  const question = questions?.[questionnaireStep] ?? null;
  const lastQuestionRef = useRef(question);
  if (question) lastQuestionRef.current = question;
  const display = question ?? lastQuestionRef.current;

  if (!display) return null;

  const entry = questionnaireAnswers.get(questionnaireStep) ?? {
    selected: new Set<string>(),
    freeText: "",
  };

  const totalQuestions = questions?.length ?? 0;

  return (
    <div className="flex flex-col gap-3 p-3">
      {!isSingleQuestion && totalQuestions > 1 && (
        <div className="flex items-center gap-1 self-end shrink-0">
          <button
            type="button"
            onClick={goBack}
            disabled={questionnaireStep === 0}
            className="flex size-6 cursor-pointer items-center justify-center rounded-md text-slate-11 transition-colors hover:bg-slate-3 hover:text-slate-12 disabled:pointer-events-none disabled:opacity-30"
          >
            <ChevronLeftIcon className="size-3.5" />
          </button>
          <span className="text-2xs tabular-nums text-slate-10">
            {questionnaireStep + 1} of {totalQuestions}
          </span>
          <button
            type="button"
            onClick={goNext}
            disabled={questionnaireStep === totalQuestions - 1}
            className="flex size-6 cursor-pointer items-center justify-center rounded-md text-slate-11 transition-colors hover:bg-slate-3 hover:text-slate-12 disabled:pointer-events-none disabled:opacity-30"
          >
            <ChevronRightIcon className="size-3.5" />
          </button>
        </div>
      )}

      <p className="text-sm font-medium leading-tight">{display.question}</p>

      {display.options && (
        <fieldset className="flex flex-col gap-1.5">
          {display.options.map((option) => {
            const isSelected = entry.selected.has(option.label);
            return (
              <label
                key={option.label}
                className={cn(
                  "flex cursor-pointer items-start gap-2.5 rounded-lg border px-3 py-2 transition-colors",
                  isSelected
                    ? "border-slate-7 bg-slate-1"
                    : "border-slate-7 bg-slate-2 hover:bg-slate-3",
                )}
              >
                <input
                  type={display.multiSelect ? "checkbox" : "radio"}
                  name={`q-${questionnaireStep}`}
                  checked={isSelected}
                  onChange={() =>
                    toggleQuestionOption(
                      questionnaireStep,
                      option.label,
                      !!display.multiSelect,
                    )
                  }
                  className="mt-0.5 accent-primary"
                />
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="text-sm leading-tight">{option.label}</span>
                  {option.description && (
                    <span className="text-muted-foreground text-xs leading-snug">
                      {option.description}
                    </span>
                  )}
                </span>
              </label>
            );
          })}
        </fieldset>
      )}
    </div>
  );
};

// DismissAction — ghost button with ESC indicator
type ComposerDismissActionProps = ComponentProps<typeof Button>;

const ComposerDismissAction = ({
  className,
  ...props
}: ComposerDismissActionProps) => {
  const { dismissStep } = useContext(ComposerContext);
  return (
    <Button
      type="button"
      variant="ghost"
      className={cn("gap-2", className)}
      onClick={dismissStep}
      {...props}
    >
      Dismiss
      <kbd className="pointer-events-none text-2xs text-slate-10 font-normal">
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
  const { isLastQuestionStep } = useContext(ComposerContext);
  return (
    <Button type="submit" className={cn("gap-2", className)} {...props}>
      {isLastQuestionStep ? "Submit" : "Continue"}
      <kbd className="pointer-events-none text-2xs text-slate-10 font-normal">
        ↵
      </kbd>
    </Button>
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
});
