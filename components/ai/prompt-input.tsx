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
  type MouseEvent,
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

type PromptInputContextValue = {
  editorRef: RefObject<Editor | null>;
  attachmentsApi: RefObject<AttachmentsApi | null>;
  isDragging: boolean;
  isSubmitting: boolean;
  hasContent: boolean;
  setHasContent: (has: boolean) => void;
  items: AttachmentItem[];
  itemsRef: RefObject<AttachmentItem[]>;
  setItems: React.Dispatch<React.SetStateAction<AttachmentItem[]>>;
  attachmentError: string | null;
  setAttachmentError: (error: string | null) => void;
};

const PromptInputContext = createContext<PromptInputContextValue>({
  editorRef: { current: null },
  attachmentsApi: { current: null },
  isDragging: false,
  isSubmitting: false,
  hasContent: false,
  setHasContent: () => {},
  items: [],
  itemsRef: { current: [] },
  setItems: () => {},
  attachmentError: null,
  setAttachmentError: () => {},
});

// Drag handler factory — shared between element and document scoping
const createDragHandlers = (
  api: RefObject<AttachmentsApi | null>,
  counter: { current: number },
  setDragging: (v: boolean) => void,
) => ({
  onDragOver: (e: Event) => {
    if (!api.current) return;
    const event = e as DragEvent;
    if (event.dataTransfer?.types?.includes("Files")) event.preventDefault();
  },
  onDragEnter: (e: Event) => {
    if (!api.current) return;
    const event = e as DragEvent;
    if (event.dataTransfer?.types?.includes("Files")) {
      counter.current++;
      setDragging(true);
    }
  },
  onDragLeave: () => {
    if (!api.current) return;
    counter.current--;
    if (counter.current === 0) setDragging(false);
  },
  onDrop: (e: Event) => {
    if (!api.current) return;
    const event = e as DragEvent;
    if (event.dataTransfer?.types?.includes("Files")) event.preventDefault();
    counter.current = 0;
    setDragging(false);
    if (event.dataTransfer?.files && event.dataTransfer.files.length > 0) {
      api.current.add(event.dataTransfer.files);
    }
  },
});

// Root — renders <form>, owns submit lifecycle
type PromptInputRootProps = Omit<ComponentProps<"form">, "onSubmit"> & {
  onSubmit?: (data: {
    text: string;
    files: FileUIPart[];
  }) => void | Promise<void>;
  isSubmitting?: boolean;
  globalDrop?: boolean;
};

const PromptInputRoot = ({
  children,
  className,
  onSubmit,
  isSubmitting = false,
  globalDrop = false,
  ...formProps
}: PromptInputRootProps) => {
  const editorRef = useRef<Editor | null>(null);
  const attachmentsApi = useRef<AttachmentsApi | null>(null);
  const rootRef = useRef<HTMLFormElement | null>(null);

  const [isDragging, setIsDragging] = useState(false);
  const [hasContent, setHasContent] = useState(false);
  const [items, setItems] = useState<AttachmentItem[]>([]);
  const itemsRef = useRef<AttachmentItem[]>(items);
  itemsRef.current = items;
  const [attachmentError, setAttachmentError] = useState<string | null>(null);
  const dragCounter = useRef(0);

  const handleFormSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (isSubmitting) return;

    const text = editorRef.current?.getText()?.trim() ?? "";
    if (!text && !items.length) return;

    const submitText = text || "Sent with attachments";
    const files =
      items.length > 0 ? await prepareAttachmentsForSend(items) : [];

    revokeAllAttachmentUrls(items);
    setItems([]);
    editorRef.current?.commands.setContent("");
    setHasContent(false);

    await onSubmit?.({ text: submitText, files });
  };

  const handleMouseDown = (e: MouseEvent<HTMLFormElement>) => {
    const target = e.target as HTMLElement;
    if (
      target.tagName === "BUTTON" ||
      target.tagName === "A" ||
      target.closest("button, a")
    )
      return;

    e.preventDefault();
    const editor = editorRef.current;
    if (editor && !editor.isFocused) {
      editor.commands.focus();
    }
  };

  // Drag handlers — gated by attachmentsApi registration
  useEffect(() => {
    const target = globalDrop ? document : rootRef.current;
    if (!target) return;

    const { onDragOver, onDragEnter, onDragLeave, onDrop } = createDragHandlers(
      attachmentsApi,
      dragCounter,
      setIsDragging,
    );

    target.addEventListener("dragover", onDragOver);
    target.addEventListener("dragenter", onDragEnter);
    target.addEventListener("dragleave", onDragLeave);
    target.addEventListener("drop", onDrop);
    return () => {
      target.removeEventListener("dragover", onDragOver);
      target.removeEventListener("dragenter", onDragEnter);
      target.removeEventListener("dragleave", onDragLeave);
      target.removeEventListener("drop", onDrop);
    };
  }, [globalDrop]);

  const contextValue = useMemo(
    () => ({
      editorRef,
      attachmentsApi,
      isDragging,
      isSubmitting,
      hasContent,
      setHasContent,
      items,
      itemsRef,
      setItems,
      attachmentError,
      setAttachmentError,
    }),
    [isDragging, isSubmitting, hasContent, items, attachmentError],
  );

  return (
    <PromptInputContext.Provider value={contextValue}>
      <form
        onSubmit={handleFormSubmit}
        onMouseDown={handleMouseDown}
        ref={rootRef}
        className={cn(
          "relative border border-slate-6 bg-slate-1 rounded-4xl shadow-xs [corner-shape:squircle] w-full cursor-text",
          "transition-colors",
          className,
        )}
        {...formProps}
      >
        {children}
      </form>
    </PromptInputContext.Provider>
  );
};

// Attachments — self-registering leaf, internal state
type PromptInputAttachmentsProps = {
  className?: string;
  accept?: string;
  maxFiles?: number;
  maxFileSize?: number;
  multiple?: boolean;
};

const PromptInputAttachments = ({
  className,
  accept = DEFAULT_ATTACHMENT_ACCEPT,
  maxFiles = DEFAULT_ATTACHMENT_MAX_FILES,
  maxFileSize = DEFAULT_ATTACHMENT_MAX_FILE_SIZE,
  multiple = true,
}: PromptInputAttachmentsProps) => {
  const {
    attachmentsApi,
    isDragging,
    items,
    itemsRef,
    setItems,
    setAttachmentError,
  } = useContext(PromptInputContext);

  // Callbacks — stable deps (functional setItems + primitive config).
  // itemsRef.current is intentionally read at call time, not a reactive dep.
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

      const capacity = Math.max(0, maxFiles - itemsRef.current.length);
      const capped = sized.slice(0, capacity);

      if (sized.length > capacity) {
        setAttachmentError("Too many files. Some were not added.");
      }

      if (!capped.length) return;

      setAttachmentError(null);
      setItems((prev) => [...prev, ...capped.map(toAttachmentItem)]);
    },
    [accept, maxFiles, maxFileSize, setAttachmentError, setItems],
  );

  // biome-ignore lint/correctness/useExhaustiveDependencies: itemsRef is a stable ref read at call time
  const remove = useCallback(
    (id: string) => {
      const found = itemsRef.current.find((item) => item.id === id);
      if (found) revokeAttachmentUrl(found);
      setItems((prev) => prev.filter((item) => item.id !== id));
      setAttachmentError(null);
    },
    [setAttachmentError, setItems],
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
        revokeAllAttachmentUrls(itemsRef.current);
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

      {/* Dropzone indicator */}
      <AnimatePresence initial={false}>
        {isDragging && (
          <motion.div
            initial={{ height: 0, padding: 0 }}
            animate={{ height: "auto", padding: "4px" }}
            exit={{ height: 0, padding: 0 }}
            transition={{ duration: 0.15, ease: "easeOut" }}
            className="overflow-hidden"
          >
            {/* If there's an attachment already, slide the dropzone up */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15, delay: 0.15 }}
              className="flex flex-col h-12 items-center justify-center gap-2 rounded-xl border border-dashed border-slate-8 bg-slate-2"
            >
              <span className="text-sm font-medium">Drop files here</span>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Attachment list */}
      <Attachments show={items.length > 0} className={className}>
        {items.map((item, index) => (
          <Attachments.Item key={item.id} item={item} index={index}>
            <Attachments.Remove onRemove={() => remove(item.id)} />
          </Attachments.Item>
        ))}
      </Attachments>
      <Attachments.Error />
    </>
  );
};

// Textarea — TipTap editor, pushes hasContent into context

type PromptInputTextareaProps = {
  value?: string;
  onValueChange?: (content: string) => void;
  className?: string;
  disabled?: boolean;
  autoFocus?: boolean;
  children?: ReactNode;
};

const PromptInputTextarea = ({
  value,
  onValueChange,
  className,
  disabled = false,
  autoFocus = false,
  children,
}: PromptInputTextareaProps) => {
  const { editorRef, attachmentsApi, itemsRef, setHasContent } =
    useContext(PromptInputContext);

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
          const lastItem = itemsRef.current.at(-1);
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
    onCreate: ({ editor }) => {
      editorRef.current = editor;
    },
    onDestroy: () => {
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
      (child) => isValidElement(child) && child.type === PromptInputPlaceholder,
    );
  }, [children]);

  return (
    <div
      data-slot="prompt-input-textarea"
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
              data-slot="prompt-input-placeholder"
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
type PromptInputPlaceholderProps =
  | { placeholder: string | string[]; children?: never; className?: string }
  | { placeholder?: never; children: ReactNode; className?: string };

const PromptInputPlaceholder = ({
  placeholder,
  children,
  className,
}: PromptInputPlaceholderProps) => {
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
    return (
      <div className={cn("text-muted-foreground/60", className)}>{content}</div>
    );
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
          className={cn("text-muted-foreground/60", className)}
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
type PromptInputFooterProps = ComponentProps<"div">;

const PromptInputFooter = ({ className, ...props }: PromptInputFooterProps) => (
  <div className={cn("flex justify-end p-2", className)} {...props} />
);

// AttachmentTrigger — reads attachmentsApi from context
type PromptInputAttachmentTriggerProps = ComponentProps<typeof IconButton>;

const PromptInputAttachmentTrigger = (
  props: PromptInputAttachmentTriggerProps,
) => {
  const { attachmentsApi } = useContext(PromptInputContext);

  const handleClick = useCallback(() => {
    attachmentsApi.current?.openFileDialog();
  }, [attachmentsApi]);

  return (
    <Attachments.Trigger onClick={handleClick} {...props}></Attachments.Trigger>
  );
};

// Submit — auto-disables via context
type PromptInputSubmitProps = ComponentProps<typeof IconButton>;

const PromptInputSubmit = ({
  children,
  className,
  disabled,
  ...props
}: PromptInputSubmitProps) => {
  const { hasContent, items, isSubmitting } = useContext(PromptInputContext);

  const autoDisabled =
    disabled ?? ((!hasContent && items.length === 0) || isSubmitting);

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

// Compound export
export const PromptInput = Object.assign(PromptInputRoot, {
  Attachments: PromptInputAttachments,
  AttachmentTrigger: PromptInputAttachmentTrigger,
  Footer: PromptInputFooter,
  Placeholder: PromptInputPlaceholder,
  Submit: PromptInputSubmit,
  Textarea: PromptInputTextarea,
});
