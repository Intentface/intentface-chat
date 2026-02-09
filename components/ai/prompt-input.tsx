"use client";

import Document from "@tiptap/extension-document";
import Paragraph from "@tiptap/extension-paragraph";
import Text from "@tiptap/extension-text";
import { type Editor, EditorContent, useEditor } from "@tiptap/react";
import { AnimatePresence, motion } from "motion/react";
import React, {
  Children,
  type ComponentProps,
  createContext,
  isValidElement,
  type ReactNode,
  type RefObject,
  useContext,
  useEffect,
  useMemo,
  useRef,
} from "react";
import { useLoop } from "@/hooks/use-loop";
import { cn } from "@/lib/utils";

const PromptInputContext = createContext<{
  editorRef: RefObject<Editor | null>;
}>({
  editorRef: { current: null },
});

export type PromptInputRootProps = ComponentProps<"div">;

const PromptInputRoot = ({ children, className }: PromptInputRootProps) => {
  const editorRef = useRef<Editor | null>(null);

  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    // Don't focus if clicking on an interactive element

    const target = e.target as HTMLElement;
    if (
      target.tagName === "BUTTON" ||
      target.tagName === "A" ||
      target.closest("button, a")
    ) {
      return;
    }

    e.preventDefault(); // Prevent default behavior that would blur the editor

    // Focus the editor using TipTap's API if not already focused
    const editor = editorRef.current;
    if (editor && !editor.isFocused) {
      editor.commands.focus();
    }
  };

  return (
    <PromptInputContext.Provider value={{ editorRef }}>
      {/* biome-ignore lint/a11y/noStaticElementInteractions: Click-to-focus container delegates to contenteditable input inside */}
      <div
        onMouseDown={handleMouseDown}
        className={cn(
          "border-input bg-background rounded-lg border w-full cursor-text",
          "has-[[data-slot=prompt-input-textarea]:focus-within]:border-ring",
          "has-[[data-slot=prompt-input-textarea]:focus-within]:ring-3",
          "has-[[data-slot=prompt-input-textarea]:focus-within]:ring-ring/50",
          "transition-colors",
          className,
        )}
      >
        {children}
      </div>
    </PromptInputContext.Provider>
  );
};

type PromptInputPlaceholderProps =
  | { placeholder: string | string[]; children?: never; className?: string }
  | { placeholder?: never; children: ReactNode; className?: string };

const PromptInputPlaceholder = ({
  placeholder,
  children,
  className,
}: PromptInputPlaceholderProps) => {
  // Determine items to display (mutually exclusive: placeholder OR children)
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

  // Use loop hook for animation when there are multiple items
  const { currentItem, key } = useLoop(
    items.map((item) => (typeof item === "string" ? item : "")),
    3000,
  );

  if (!isLooping && items.length === 1) {
    // Static placeholder
    const content = typeof items[0] === "string" ? items[0] : items[0];
    return (
      <div className={cn("text-muted-foreground/60", className)}>{content}</div>
    );
  }

  if (!isLooping && items.length === 0) {
    return null;
  }

  // Animated looping placeholder
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
  const { editorRef } = useContext(PromptInputContext);

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [Document, Paragraph, Text],
    content: value,
    editorProps: {
      attributes: {
        class: cn("max-w-none focus:outline-none w-full"),
      },
      handleKeyDown: (view, event) => {
        if (event.key === "Enter" && !event.shiftKey) {
          // Prevent TipTap from creating a new paragraph
          event.preventDefault();
          // Find and submit the parent form
          const form = (event.target as HTMLElement).closest("form");
          if (form) {
            form.requestSubmit();
          }
          return true;
        }
        if (event.key === "Enter" && event.shiftKey) {
          // Manually insert a new paragraph for Shift+Enter
          const { state, dispatch } = view;
          const { tr } = state;
          dispatch(tr.split(state.selection.$from.pos));
          return true;
        }
        return false;
      },
    },

    onCreate: ({ editor }) => {
      console.log("onCreate", editor);
      editorRef.current = editor;
    },
    onDestroy: () => {
      console.log("onDestroy");
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

  // Find placeholder child
  const placeholder = useMemo(() => {
    return Children.toArray(children).find(
      (child) => isValidElement(child) && child.type === PromptInputPlaceholder,
    );
  }, [children]);

  if (!editor) {
    return null;
  }

  const isEmpty = editor.isEmpty;

  return (
    <div
      data-slot="prompt-input-textarea"
      className={cn(
        "max-h-32 min-h-lh overflow-y-auto px-3 py-2 text-sm",
        "mask-[linear-gradient(to_bottom,transparent,black_16px,black_calc(100%-16px),transparent)]",
        disabled && "opacity-50 cursor-not-allowed",
        className,
      )}
    >
      <EditorContent editor={editor} className="relative">
        {isEmpty && placeholder && (
          <div
            data-slot="prompt-input-placeholder"
            className="absolute inset-0 min-h-lh pointer-events-none"
            aria-hidden="true"
          >
            {placeholder}
          </div>
        )}
      </EditorContent>
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

export const PromptInput = Object.assign(PromptInputRoot, {
  Body: PromptInputBody,
  Textarea: PromptInputTextarea,
  Placeholder: PromptInputPlaceholder,
  Footer: PromptInputFooter,
});
