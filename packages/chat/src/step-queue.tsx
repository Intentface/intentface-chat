"use client";

// Headless step queue: an expandable, click/keyboard-togglable stack of live
// steps. Owns only the open state and toggle interaction — item enter/exit
// choreography and collapsed-height math belong to the styled layer, which
// reads the open state via useStepQueue().

import { type ComponentProps, createContext, use, useCallback, useState } from "react";

type StepQueueContextValue = {
  isOpen: boolean;
  toggle: () => void;
};

const StepQueueContext = createContext<StepQueueContextValue | null>(null);

export const useStepQueue = () => {
  const ctx = use(StepQueueContext);
  if (!ctx) throw new Error("useStepQueue must be used within <StepQueue>");
  return ctx;
};

export type StepQueueRootProps = ComponentProps<"div"> & {
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
};

const StepQueueRoot = ({
  open: controlledOpen,
  defaultOpen = false,
  onOpenChange,
  children,
  ...props
}: StepQueueRootProps) => {
  const [internalOpen, setInternalOpen] = useState(defaultOpen);
  const isControlled = controlledOpen !== undefined;
  const isOpen = isControlled ? controlledOpen : internalOpen;

  const toggle = useCallback(() => {
    const next = !isOpen;
    if (!isControlled) setInternalOpen(next);
    onOpenChange?.(next);
  }, [isOpen, isControlled, onOpenChange]);

  return (
    <StepQueueContext value={{ isOpen, toggle }}>
      <div
        role="button"
        tabIndex={0}
        data-slot="step-queue"
        data-open={isOpen || undefined}
        onClick={toggle}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            toggle();
          }
        }}
        {...props}
      >
        {children}
      </div>
    </StepQueueContext>
  );
};

StepQueueRoot.displayName = "StepQueue";

export type StepQueueItemProps = ComponentProps<"div">;

const StepQueueItem = (props: StepQueueItemProps) => <div data-slot="step-queue-item" {...props} />;

StepQueueItem.displayName = "StepQueueItem";

export type StepQueueIconProps = ComponentProps<"span">;

const StepQueueIcon = (props: StepQueueIconProps) => (
  <span data-slot="step-queue-icon" {...props} />
);

StepQueueIcon.displayName = "StepQueueIcon";

export type StepQueueLabelProps = ComponentProps<"span"> & {
  active?: boolean;
};

const StepQueueLabel = ({ active = false, ...props }: StepQueueLabelProps) => (
  <span data-slot="step-queue-label" data-active={active || undefined} {...props} />
);

StepQueueLabel.displayName = "StepQueueLabel";

export const StepQueue = Object.assign(StepQueueRoot, {
  Item: StepQueueItem,
  Icon: StepQueueIcon,
  Label: StepQueueLabel,
});
