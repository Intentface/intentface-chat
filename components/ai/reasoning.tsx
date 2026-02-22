"use client";

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
import { TextLoop } from "../ui/text-loop";
import { TextShimmer } from "../ui/text-shimmer";

const AUTO_CLOSE_DELAY = 1000;
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

export type ReasoningRootProps = Omit<
  ComponentProps<typeof Collapsible>,
  "onOpenChange"
> & {
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
    const resolvedDefaultOpen = defaultOpen ?? isStreaming;
    const isExplicitlyClosed = defaultOpen === false;

    const [internalOpen, setInternalOpen] = useState(resolvedDefaultOpen);
    const isControlled = controlledOpen !== undefined;
    const isOpen = isControlled ? controlledOpen : internalOpen;

    const [duration, setDuration] = useState<number | undefined>(durationProp);
    const hasEverStreamedRef = useRef(isStreaming);
    const [hasAutoClosed, setHasAutoClosed] = useState(false);
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

    // Auto-open when streaming starts (unless explicitly closed)
    useEffect(() => {
      if (isStreaming && !isOpen && !isExplicitlyClosed) {
        setIsOpen(true);
      }
    }, [isStreaming, isOpen, setIsOpen, isExplicitlyClosed]);

    // Auto-close after delay when streaming ends (once only)
    useEffect(() => {
      if (
        hasEverStreamedRef.current &&
        !isStreaming &&
        isOpen &&
        !hasAutoClosed
      ) {
        const timer = setTimeout(() => {
          setIsOpen(false);
          setHasAutoClosed(true);
        }, AUTO_CLOSE_DELAY);
        return () => clearTimeout(timer);
      }
    }, [isStreaming, isOpen, setIsOpen, hasAutoClosed]);

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

export type ReasoningTriggerProps = ComponentProps<
  typeof Collapsible.Trigger
> & {
  getThinkingMessage?: (
    isStreaming: boolean,
    duration?: number,
  ) => { key: string; component: ReactNode };
};

const defaultGetThinkingMessage = (
  isStreaming: boolean,
  duration?: number,
): { key: string; component: ReactNode } => {
  if (isStreaming || duration === 0) {
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
    getThinkingMessage = defaultGetThinkingMessage,
    className,
    children,
    ...props
  }: ReasoningTriggerProps) => {
    const { isStreaming, isOpen, duration } = useReasoning();

    const { key, component } = getThinkingMessage(isStreaming, duration);
    return (
      <Collapsible.Trigger
        className={cn(
          "inline-flex cursor-pointer h-8 text-sm items-center gap-2 text-muted-foreground transition-colors hover:text-foreground",
          className,
        )}
        {...props}
      >
        {children ?? (
          <>
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
            <ChevronDownIcon
              className={cn(
                "size-4 transition-transform",
                isOpen ? "rotate-180" : "rotate-0",
              )}
            />
          </>
        )}
      </Collapsible.Trigger>
    );
  },
);

ReasoningTrigger.displayName = "ReasoningTrigger";

export type ReasoningContentProps = Omit<
  ComponentProps<typeof Collapsible.Panel>,
  "children"
> & {
  children: string;
};

const ReasoningContent = ({
  children,
  className,
  ...props
}: ReasoningContentProps) => (
  <Collapsible.Panel className={cn("mt-2 text-sm", className)} {...props}>
    <Markdown className="text-slate-11 space-y-2 text-sm">{children}</Markdown>
  </Collapsible.Panel>
);

export const Reasoning = Object.assign(ReasoningRoot, {
  Trigger: ReasoningTrigger,
  Content: ReasoningContent,
});
