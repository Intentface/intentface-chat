"use client";

// Headless reasoning disclosure. Owns the open state and the streaming
// duration tracking; exposes them via useReasoning() so the styled layer can
// render its own trigger label (shimmer, crossfade) and markdown content.

import {
  type ComponentProps,
  createContext,
  memo,
  use,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Collapsible } from "./internal/collapsible";

const MS_IN_S = 1000;

type ReasoningContextValue = {
  isStreaming: boolean;
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
  duration: number | undefined;
};

const ReasoningContext = createContext<ReasoningContextValue | null>(null);

export const useReasoning = () => {
  const context = use(ReasoningContext);
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
      <ReasoningContext value={contextValue}>
        <Collapsible
          open={isOpen}
          onOpenChange={(open) => setIsOpen(open)}
          aria-busy={isStreaming || undefined}
          data-reasoning=""
          data-streaming={isStreaming ? "" : undefined}
          {...props}
        >
          {children}
        </Collapsible>
      </ReasoningContext>
    );
  },
);

ReasoningRoot.displayName = "Reasoning";

export type ReasoningTriggerProps = ComponentProps<typeof Collapsible.Trigger>;

const ReasoningTrigger = (props: ReasoningTriggerProps) => (
  <Collapsible.Trigger data-reasoning-trigger="" {...props} />
);

export type ReasoningContentProps = ComponentProps<typeof Collapsible.Panel>;

const ReasoningContent = (props: ReasoningContentProps) => (
  <Collapsible.Panel data-reasoning-content="" {...props} />
);

export const Reasoning = Object.assign(ReasoningRoot, {
  Trigger: ReasoningTrigger,
  Content: ReasoningContent,
});
