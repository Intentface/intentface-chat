"use client";

// Headless step queue: an expandable, click/keyboard-togglable stack of live
// steps. Owns only the open state and toggle interaction — item enter/exit
// choreography and collapsed-height math belong to the styled layer, which
// reads the open state via useStepQueue(). Every part supports the Base UI
// render prop; open/closed surface as generated presence attributes.

import { createContext, use, useCallback, useState } from "react";
import type { PrimitiveProps } from "./internal/primitive-props";
import { useRenderElement } from "./internal/render/useRenderElement";
import { openStateMapping } from "./internal/state-mappings";

export type StepQueueState = {
  open: boolean;
};

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

export type StepQueueRootProps = PrimitiveProps<"div", StepQueueState> & {
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
};

const StepQueueRoot = ({
  open: controlledOpen,
  defaultOpen = false,
  onOpenChange,
  className,
  render,
  style,
  ...elementProps
}: StepQueueRootProps) => {
  const [internalOpen, setInternalOpen] = useState(defaultOpen);
  const isControlled = controlledOpen !== undefined;
  const isOpen = isControlled ? controlledOpen : internalOpen;

  const toggle = useCallback(() => {
    const next = !isOpen;
    if (!isControlled) setInternalOpen(next);
    onOpenChange?.(next);
  }, [isOpen, isControlled, onOpenChange]);

  const element = useRenderElement(
    "div",
    { className, render, style },
    {
      state: { open: isOpen },
      stateAttributesMapping: openStateMapping,
      props: [
        {
          role: "button",
          tabIndex: 0,
          "data-slot": "step-queue",
          onClick: toggle,
          onKeyDown: (e: React.KeyboardEvent) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              toggle();
            }
          },
        },
        elementProps,
      ],
    },
  );

  return <StepQueueContext value={{ isOpen, toggle }}>{element}</StepQueueContext>;
};

StepQueueRoot.displayName = "StepQueue";

export type StepQueueItemProps = PrimitiveProps<"div">;

const StepQueueItem = ({ className, render, style, ...elementProps }: StepQueueItemProps) =>
  useRenderElement(
    "div",
    { className, render, style },
    { props: [{ "data-slot": "step-queue-item" }, elementProps] },
  );

StepQueueItem.displayName = "StepQueueItem";

export type StepQueueIconProps = PrimitiveProps<"span">;

const StepQueueIcon = ({ className, render, style, ...elementProps }: StepQueueIconProps) =>
  useRenderElement(
    "span",
    { className, render, style },
    { props: [{ "data-slot": "step-queue-icon" }, elementProps] },
  );

StepQueueIcon.displayName = "StepQueueIcon";

export type StepQueueLabelState = {
  active: boolean;
};

export type StepQueueLabelProps = PrimitiveProps<"span", StepQueueLabelState> & {
  active?: boolean;
};

const StepQueueLabel = ({
  active = false,
  className,
  render,
  style,
  ...elementProps
}: StepQueueLabelProps) =>
  useRenderElement(
    "span",
    { className, render, style },
    { state: { active }, props: [{ "data-slot": "step-queue-label" }, elementProps] },
  );

StepQueueLabel.displayName = "StepQueueLabel";

export const StepQueue = Object.assign(StepQueueRoot, {
  Item: StepQueueItem,
  Icon: StepQueueIcon,
  Label: StepQueueLabel,
});
