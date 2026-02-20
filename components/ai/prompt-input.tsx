"use client";

import Document from "@tiptap/extension-document";
import Paragraph from "@tiptap/extension-paragraph";
import Text from "@tiptap/extension-text";
import { type Editor, EditorContent, useEditor } from "@tiptap/react";
import type { FileUIPart } from "ai";
import { AnimatePresence, motion } from "motion/react";
import React, {
  Children,
  type ComponentProps,
  createContext,
  isValidElement,
  type ReactNode,
  type RefObject,
  useCallback,
  useContext,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from "react";
import { IconButton } from "@/components/ui/icon-button";
import { useLoop } from "@/hooks/use-loop";
import { cn } from "@/lib/utils";
import { SendIcon } from "../icons/send";
import { AttachmentsInline } from "./attachments-inline";
import {
  type AttachmentError,
  type AttachmentItem,
  DEFAULT_ATTACHMENT_ACCEPT,
  DEFAULT_ATTACHMENT_MAX_FILE_SIZE,
  DEFAULT_ATTACHMENT_MAX_FILES,
  matchesAccept,
  prepareAttachmentsForSend,
  revokeAllAttachmentUrls,
  revokeAttachmentUrl,
  toAttachmentItem,
} from "./prompt-input-attachments";

const PromptInputContext = createContext<{
  editorRef: RefObject<Editor | null>;
  attachments: AttachmentItem[];
  attachmentError: string | null;
  addAttachments: (files: File[] | FileList) => void;
  removeAttachment: (id: string) => void;
  clearAttachments: () => void;
  openFileDialog: () => void;
}>({
  editorRef: { current: null },
  attachments: [],
  attachmentError: null,
  addAttachments: () => {},
  removeAttachment: () => {},
  clearAttachments: () => {},
  openFileDialog: () => {},
});

export const usePromptInputAttachments = () => {
  const ctx = useContext(PromptInputContext);
  return {
    add: ctx.addAttachments,
    clear: ctx.clearAttachments,
    error: ctx.attachmentError,
    files: ctx.attachments,
    openFileDialog: ctx.openFileDialog,
    remove: ctx.removeAttachment,
  };
};

export const preparePromptInputAttachments = prepareAttachmentsForSend;
export const revokePromptInputAttachmentUrls = revokeAllAttachmentUrls;
export type { AttachmentError, AttachmentItem };

export interface PromptInputHandle {
  clearAttachments: () => void;
  hasAttachments: () => boolean;
  prepareAttachments: () => Promise<FileUIPart[]>;
}

export type PromptInputRootProps = ComponentProps<"div"> & {
  attachments?: AttachmentItem[];
  onAttachmentsChange?: (attachments: AttachmentItem[]) => void;
  onAttachmentError?: (error: AttachmentError) => void;
  accept?: string;
  maxFiles?: number;
  maxFileSize?: number;
  multiple?: boolean;
  globalDrop?: boolean;
};

const PromptInputRoot = React.forwardRef<
  PromptInputHandle,
  PromptInputRootProps
>(
  (
    {
      children,
      className,
      attachments: controlledAttachments,
      onAttachmentsChange,
      onAttachmentError,
      accept = DEFAULT_ATTACHMENT_ACCEPT,
      maxFiles = DEFAULT_ATTACHMENT_MAX_FILES,
      maxFileSize = DEFAULT_ATTACHMENT_MAX_FILE_SIZE,
      multiple = true,
      globalDrop = false,
    },
    ref,
  ) => {
    const editorRef = useRef<Editor | null>(null);
    const inputRef = useRef<HTMLInputElement | null>(null);
    const rootRef = useRef<HTMLDivElement | null>(null);

    const [internalAttachments, setInternalAttachments] = useState<
      AttachmentItem[]
    >([]);
    const [attachmentError, setAttachmentError] = useState<string | null>(null);

    const isControlled = controlledAttachments !== undefined;
    const attachments = controlledAttachments ?? internalAttachments;
    const attachmentsRef = useRef(attachments);

    useEffect(() => {
      attachmentsRef.current = attachments;
    }, [attachments]);

    const updateAttachments = useCallback(
      (
        nextAttachments:
          | AttachmentItem[]
          | ((prev: AttachmentItem[]) => AttachmentItem[]),
      ) => {
        const resolvedNext =
          typeof nextAttachments === "function"
            ? nextAttachments(attachmentsRef.current)
            : nextAttachments;

        if (!isControlled) {
          setInternalAttachments(resolvedNext);
        }

        attachmentsRef.current = resolvedNext;
        onAttachmentsChange?.(resolvedNext);
      },
      [isControlled, onAttachmentsChange],
    );

    const addAttachments = useCallback(
      (fileList: File[] | FileList) => {
        const incoming = [...fileList];
        if (incoming.length === 0) {
          return;
        }

        const accepted = incoming.filter((file) => matchesAccept(file, accept));
        if (incoming.length > 0 && accepted.length === 0) {
          const message = "No files match the accepted types.";
          setAttachmentError(message);
          onAttachmentError?.({
            code: "accept",
            message,
          });
          return;
        }

        const sized = accepted.filter((file) => file.size <= maxFileSize);
        if (accepted.length > 0 && sized.length === 0) {
          const message = "All files exceed the maximum size.";
          setAttachmentError(message);
          onAttachmentError?.({
            code: "max_file_size",
            message,
          });
          return;
        }

        const capacity = Math.max(0, maxFiles - attachmentsRef.current.length);
        const capped = sized.slice(0, capacity);

        if (sized.length > capacity) {
          const message = "Too many files. Some were not added.";
          setAttachmentError(message);
          onAttachmentError?.({
            code: "max_files",
            message,
          });
        }

        if (capped.length === 0) {
          return;
        }

        setAttachmentError(null);
        updateAttachments((prev) => [...prev, ...capped.map(toAttachmentItem)]);
      },
      [accept, maxFiles, maxFileSize, onAttachmentError, updateAttachments],
    );

    const removeAttachment = useCallback(
      (id: string) => {
        updateAttachments((prev) => {
          const found = prev.find((item) => item.id === id);
          if (found) {
            revokeAttachmentUrl(found);
          }
          return prev.filter((item) => item.id !== id);
        });
        setAttachmentError(null);
      },
      [updateAttachments],
    );

    const clearAttachments = useCallback(() => {
      updateAttachments((prev) => {
        revokeAllAttachmentUrls(prev);
        return [];
      });
      setAttachmentError(null);
    }, [updateAttachments]);

    useImperativeHandle(
      ref,
      () => ({
        clearAttachments,
        hasAttachments: () => attachmentsRef.current.length > 0,
        prepareAttachments: () =>
          prepareAttachmentsForSend(attachmentsRef.current),
      }),
      [clearAttachments],
    );

    const openFileDialog = useCallback(() => {
      inputRef.current?.click();
    }, []);

    const handleFileChange = useCallback(
      (event: React.ChangeEvent<HTMLInputElement>) => {
        if (event.currentTarget.files) {
          addAttachments(event.currentTarget.files);
        }
        event.currentTarget.value = "";
      },
      [addAttachments],
    );

    const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
      const target = e.target as HTMLElement;
      if (
        target.tagName === "BUTTON" ||
        target.tagName === "A" ||
        target.closest("button, a")
      ) {
        return;
      }

      e.preventDefault();

      const editor = editorRef.current;
      if (editor && !editor.isFocused) {
        editor.commands.focus();
      }
    };

    useEffect(() => {
      const root = rootRef.current;
      if (!root || globalDrop) {
        return;
      }

      const onDragOver = (event: DragEvent) => {
        if (event.dataTransfer?.types?.includes("Files")) {
          event.preventDefault();
        }
      };

      const onDrop = (event: DragEvent) => {
        if (event.dataTransfer?.types?.includes("Files")) {
          event.preventDefault();
        }

        if (event.dataTransfer?.files && event.dataTransfer.files.length > 0) {
          addAttachments(event.dataTransfer.files);
        }
      };

      root.addEventListener("dragover", onDragOver);
      root.addEventListener("drop", onDrop);

      return () => {
        root.removeEventListener("dragover", onDragOver);
        root.removeEventListener("drop", onDrop);
      };
    }, [addAttachments, globalDrop]);

    useEffect(() => {
      if (!globalDrop) {
        return;
      }

      const onDragOver = (event: DragEvent) => {
        if (event.dataTransfer?.types?.includes("Files")) {
          event.preventDefault();
        }
      };

      const onDrop = (event: DragEvent) => {
        if (event.dataTransfer?.types?.includes("Files")) {
          event.preventDefault();
        }

        if (event.dataTransfer?.files && event.dataTransfer.files.length > 0) {
          addAttachments(event.dataTransfer.files);
        }
      };

      document.addEventListener("dragover", onDragOver);
      document.addEventListener("drop", onDrop);

      return () => {
        document.removeEventListener("dragover", onDragOver);
        document.removeEventListener("drop", onDrop);
      };
    }, [addAttachments, globalDrop]);

    useEffect(
      () => () => {
        revokeAllAttachmentUrls(attachmentsRef.current);
      },
      [],
    );

    return (
      <PromptInputContext.Provider
        value={{
          addAttachments,
          attachmentError,
          attachments,
          clearAttachments,
          editorRef,
          openFileDialog,
          removeAttachment,
        }}
      >
        <input
          accept={accept}
          className="hidden"
          multiple={multiple}
          onChange={handleFileChange}
          ref={inputRef}
          type="file"
        />
        {/* biome-ignore lint/a11y/noStaticElementInteractions: Click-to-focus container delegates to contenteditable input inside */}
        <div
          onMouseDown={handleMouseDown}
          ref={rootRef}
          className={cn(
            "border border-slate-6 bg-slate-1 rounded-4xl [corner-shape:squircle] w-full cursor-text",
            // "has-[[data-slot=prompt-input-textarea]:focus-within]:border-ring",
            // "has-[[data-slot=prompt-input-textarea]:focus-within]:ring-3",
            // "has-[[data-slot=prompt-input-textarea]:focus-within]:ring-ring/50",
            "transition-colors",
            className,
          )}
        >
          {children}
        </div>
      </PromptInputContext.Provider>
    );
  },
);

PromptInputRoot.displayName = "PromptInputRoot";

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

  const { currentItem, key } = useLoop(
    items.map((item) => (typeof item === "string" ? item : "")),
    3000,
  );

  if (!isLooping && items.length === 1) {
    const content = typeof items[0] === "string" ? items[0] : items[0];
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

export type PromptInputTextareaProps = {
  value?: string;
  className?: string;
  onValueChange?: (content: string) => void;
  disabled?: boolean;
  autoFocus?: boolean;
  children?: ReactNode;
};

const PromptInputTextarea = ({
  value = "",
  className,
  onValueChange,
  disabled = false,
  autoFocus = false,
  children,
}: PromptInputTextareaProps) => {
  const { editorRef, attachments, addAttachments, removeAttachment } =
    useContext(PromptInputContext);

  const attachmentsRef = useRef(attachments);
  const addAttachmentsRef = useRef(addAttachments);

  useEffect(() => {
    attachmentsRef.current = attachments;
  }, [attachments]);

  useEffect(() => {
    addAttachmentsRef.current = addAttachments;
  }, [addAttachments]);

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [Document, Paragraph, Text],
    content: value,
    editorProps: {
      attributes: {
        class: cn("max-w-none focus:outline-none w-full"),
      },
      handlePaste: (_view, event) => {
        const items = event.clipboardData?.items;
        if (!items) {
          return false;
        }

        const files = [...items]
          .filter((item) => item.kind === "file")
          .map((item) => item.getAsFile())
          .filter((file): file is File => Boolean(file));

        if (files.length === 0) {
          return false;
        }

        event.preventDefault();
        addAttachmentsRef.current(files);
        return true;
      },
      handleKeyDown: (view, event) => {
        if (event.key === "Backspace" && view.state.doc.textContent === "") {
          const lastAttachment = attachmentsRef.current.at(-1);
          if (lastAttachment) {
            event.preventDefault();
            removeAttachment(lastAttachment.id);
            return true;
          }
        }

        if (event.key === "Enter" && !event.shiftKey) {
          event.preventDefault();
          const form = (event.target as HTMLElement).closest("form");
          if (form) {
            form.requestSubmit();
          }
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
      onValueChange?.(editor.getText());
    },
    editable: !disabled,
    autofocus: autoFocus,
  });

  useEffect(() => {
    if (editor && value !== editor.getText()) {
      editor.commands.setContent(value);
    }
  }, [value, editor]);

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

type PromptInputBodyProps = ComponentProps<"div">;

const PromptInputBody = ({ className, ...props }: PromptInputBodyProps) => {
  return <div className={cn("contents", className)} {...props} />;
};

type PromptInputFooterProps = ComponentProps<"div">;

const PromptInputFooter = ({ className, ...props }: PromptInputFooterProps) => {
  return <div className={cn("flex justify-end p-2", className)} {...props} />;
};

type PromptInputAttachmentsProps = {
  className?: string;
};

const PromptInputAttachments = ({ className }: PromptInputAttachmentsProps) => {
  const attachments = usePromptInputAttachments();

  return (
    <AttachmentsInline
      attachments={attachments.files}
      className={className}
      onRemove={attachments.remove}
    />
  );
};

type PromptInputAttachmentsErrorProps = ComponentProps<"p">;

const PromptInputAttachmentsError = ({
  className,
  ...props
}: PromptInputAttachmentsErrorProps) => {
  const attachments = usePromptInputAttachments();
  if (!attachments.error) {
    return null;
  }

  return (
    <p
      className={cn("px-3 pb-1 text-destructive text-xs", className)}
      {...props}
    >
      {attachments.error}
    </p>
  );
};

type PromptInputSubmitProps = ComponentProps<typeof IconButton>;

const PromptInputSubmit = ({
  children,
  className,
  ...props
}: PromptInputSubmitProps) => (
  <IconButton
    type="submit"
    variant="outline"
    className={cn("rounded-full", className)}
    {...props}
  >
    {children ?? <SendIcon />}
  </IconButton>
);

export const PromptInput = Object.assign(PromptInputRoot, {
  Attachments: PromptInputAttachments,
  AttachmentsError: PromptInputAttachmentsError,
  Body: PromptInputBody,
  Textarea: PromptInputTextarea,
  Placeholder: PromptInputPlaceholder,
  Footer: PromptInputFooter,
  Submit: PromptInputSubmit,
});
