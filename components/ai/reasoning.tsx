"use client";

import { splitReasoningByHeaders } from "@intentface/chat/message-utils";
import { AnimatePresence, motion } from "motion/react";
import {
  type ComponentProps,
  createContext,
  memo,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { ChevronDownIcon } from "@/components/icons/chevron-down";
import { Collapsible } from "@/components/ui/collapsible";
import { Markdown } from "@/components/ui/markdown";
import { cn } from "@/lib/utils";
import { BrainIcon } from "../icons/brain";
import { TextShimmer } from "../ui/text-shimmer";

const MS_IN_S = 1000;

type ReasoningContextValue = {
  isStreaming: boolean;
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
  duration: number | undefined;
};

const ReasoningContext = createContext<ReasoningContextValue | null>(null);

export const useReasoning = () => {
  const context = useContext(ReasoningContext);
  if (!context) {
    throw new Error("Reasoning components must be used within Reasoning");
  }
  return context;
};

export type ReasoningRootProps = Omit<ComponentProps<typeof Collapsible>, "onOpenChange"> & {
  isStreaming?: boolean;
  duration?: number;
  onOpenChange?: (open: boolean) => void;
};

const ReasoningRoot = memo(
  ({
    isStreaming = false,
    open: controlledOpen,
    defaultOpen,
    onOpenChange,
    duration: durationProp,
    className,
    children,
    ...props
  }: ReasoningRootProps) => {
    const resolvedDefaultOpen = defaultOpen ?? false;

    const [internalOpen, setInternalOpen] = useState(resolvedDefaultOpen);
    const isControlled = controlledOpen !== undefined;
    const isOpen = isControlled ? controlledOpen : internalOpen;

    const [duration, setDuration] = useState<number | undefined>(durationProp);
    const hasEverStreamedRef = useRef(isStreaming);
    const startTimeRef = useRef<number | null>(null);

    const setIsOpen = useCallback(
      (value: boolean) => {
        if (!isControlled) {
          setInternalOpen(value);
        }
        onOpenChange?.(value);
      },
      [isControlled, onOpenChange],
    );

    // Track when streaming starts and compute duration
    useEffect(() => {
      if (isStreaming) {
        hasEverStreamedRef.current = true;
        if (startTimeRef.current === null) {
          startTimeRef.current = Date.now();
        }
      } else if (startTimeRef.current !== null) {
        setDuration(Math.ceil((Date.now() - startTimeRef.current) / MS_IN_S));
        startTimeRef.current = null;
      }
    }, [isStreaming]);

    const contextValue = useMemo(
      () => ({ duration, isOpen, isStreaming, setIsOpen }),
      [duration, isOpen, isStreaming, setIsOpen],
    );

    return (
      <ReasoningContext.Provider value={contextValue}>
        <Collapsible
          open={isOpen}
          onOpenChange={(open) => setIsOpen(open)}
          data-slot="reasoning"
          data-streaming={isStreaming ? "" : undefined}
          className={cn("not-prose w-full", className)}
          {...props}
        >
          {children}
        </Collapsible>
      </ReasoningContext.Provider>
    );
  },
);

ReasoningRoot.displayName = "Reasoning";

export type ReasoningTriggerProps = ComponentProps<typeof Collapsible.Trigger> & {
  label?: string[];
  getThinkingMessage?: (
    isStreaming: boolean,
    duration?: number,
    label?: string,
  ) => { key: string; component: ReactNode };
};

const defaultGetThinkingMessage = (
  isStreaming: boolean,
  duration?: number,
  label?: string,
): { key: string; component: ReactNode } => {
  if (isStreaming || duration === 0) {
    if (isStreaming && label) {
      return {
        key: `header-${label}`,
        component: <TextShimmer>{label}</TextShimmer>,
      };
    }
    return {
      key: "thinking",
      component: <TextShimmer>Thinking...</TextShimmer>,
    };
  }

  return {
    key: "thought",
    component: <span>Thought for {duration ?? "a few"} seconds</span>,
  };
};

const ReasoningTrigger = memo(
  ({
    label,
    getThinkingMessage = defaultGetThinkingMessage,
    className,
    children,
    ...props
  }: ReasoningTriggerProps) => {
    const { isStreaming, isOpen, duration } = useReasoning();
    const activeLabel = label?.at(-1);

    const { key, component } = getThinkingMessage(isStreaming, duration, activeLabel);
    return (
      <Collapsible.Trigger
        className={cn(
          "flex cursor-pointer w-full text-sm items-center gap-2 text-ink-secondary rounded-md transition-colors hover:text-ink-primary",
          className,
        )}
        {...props}
      >
        {children ?? (
          <>
            <div className="flex items-center gap-1">
              <BrainIcon className="size-4" />
              <AnimatePresence mode="popLayout" initial={false}>
                <motion.span
                  key={key}
                  initial={{ opacity: 0, y: "100%", filter: "blur(4px)" }}
                  animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                  exit={{ opacity: 0, y: "-100%", filter: "blur(4px)" }}
                  transition={{ duration: 0.3, ease: "easeOut" }}
                  className="whitespace-nowrap text-gray-11/60"
                >
                  {component}
                </motion.span>
              </AnimatePresence>
            </div>
            <ChevronDownIcon
              className={cn("size-5 transition-transform", isOpen ? "rotate-180" : "rotate-0")}
            />
          </>
        )}
      </Collapsible.Trigger>
    );
  },
);

ReasoningTrigger.displayName = "ReasoningTrigger";

export type ReasoningContentProps = Omit<ComponentProps<typeof Collapsible.Panel>, "children"> & {
  children: string | string[];
};

const ReasoningContent = ({ children, className, ...props }: ReasoningContentProps) => {
  const texts = Array.isArray(children) ? children : [children];
  const sections = splitReasoningByHeaders(texts);

  return (
    <Collapsible.Panel className={cn("text-sm", className)} {...props}>
      <div className="flex flex-col gap-3 p-2">
        {sections.map((section, i) => (
          <div key={i} className="flex flex-col gap-1">
            {section.header && (
              <span className="text-sm font-medium text-ink-primary">{section.header}</span>
            )}
            {section.body && (
              <Markdown className="text-ink-secondary text-sm [&_p]:mb-0">{section.body}</Markdown>
            )}
          </div>
        ))}
      </div>
    </Collapsible.Panel>
  );
};

export const Reasoning = Object.assign(ReasoningRoot, {
  Trigger: ReasoningTrigger,
  Content: ReasoningContent,
});
