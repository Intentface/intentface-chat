"use client";

import { Reasoning as ReasoningPrimitive, useReasoning } from "@intentface/chat/reasoning";
import { Brain, ChevronDown } from "@keyline-icons/react";
import { AnimatePresence, motion } from "motion/react";
import { type ComponentProps, memo, type ReactNode } from "react";
import { Markdown } from "@/components/ui/markdown";
import { splitReasoningByHeaders } from "@/lib/ai/message-info";
import { cn } from "@/lib/utils";
import { TextShimmer } from "../ui/text-shimmer";

export { useReasoning };

export type ReasoningRootProps = ComponentProps<typeof ReasoningPrimitive.Root>;

const ReasoningRoot = memo(({ className, ...props }: ReasoningRootProps) => (
  <ReasoningPrimitive.Root className={cn("not-prose w-full", className)} {...props} />
));

ReasoningRoot.displayName = "Reasoning";

export type ReasoningTriggerProps = ComponentProps<typeof ReasoningPrimitive.Trigger> & {
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
      <ReasoningPrimitive.Trigger
        className={cn(
          "flex w-full cursor-pointer items-center gap-1.5 rounded-md font-medium text-ink-secondary text-sm transition-colors hover:text-ink-primary focus-visible:outline-2 focus-visible:outline-accent-bg/60 focus-visible:outline-offset-2",
          className,
        )}
        {...props}
      >
        {children ?? (
          <>
            <div className="flex items-center gap-1.5">
              <Brain className="size-[15px]" />
              <AnimatePresence mode="popLayout" initial={false}>
                <motion.span
                  key={key}
                  initial={{ opacity: 0, y: "100%", filter: "blur(4px)" }}
                  animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                  exit={{ opacity: 0, y: "-100%", filter: "blur(4px)" }}
                  transition={{ duration: 0.3, ease: "easeOut" }}
                  className="whitespace-nowrap"
                >
                  {component}
                </motion.span>
              </AnimatePresence>
            </div>
            <ChevronDown
              className={cn(
                "size-3.5 text-ink-tertiary transition-transform",
                isOpen ? "rotate-180" : "rotate-0",
              )}
            />
          </>
        )}
      </ReasoningPrimitive.Trigger>
    );
  },
);

ReasoningTrigger.displayName = "ReasoningTrigger";

export type ReasoningContentProps = Omit<
  ComponentProps<typeof ReasoningPrimitive.Content>,
  "children"
> & {
  children: string | string[];
};

const ReasoningContent = ({ children, className, ...props }: ReasoningContentProps) => {
  const texts = Array.isArray(children) ? children : [children];
  const sections = splitReasoningByHeaders(texts);

  return (
    <ReasoningPrimitive.Content className={cn("text-sm", className)} {...props}>
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
    </ReasoningPrimitive.Content>
  );
};

export const Reasoning = Object.assign(ReasoningRoot, {
  Trigger: ReasoningTrigger,
  Content: ReasoningContent,
});
