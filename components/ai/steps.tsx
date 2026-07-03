"use client";

import { Steps as StepsPrimitive } from "@intentface/chat/steps";
import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

// Styled mirror of the recursive Steps primitive: a container plus
// Item/Trigger/Panel disclosure nodes. Nested panels draw the timeline rail
// via the primitive's data-nested attribute — everything app-specific (tool
// derivation, row markup) lives with the app, not here.

// ---------------------------------------------------------------------------
// Root
// ---------------------------------------------------------------------------

type StepsRootProps = ComponentProps<typeof StepsPrimitive>;

const StepsRoot = ({ className, ...props }: StepsRootProps) => (
  <StepsPrimitive className={cn("not-prose w-full", className)} {...props} />
);

StepsRoot.displayName = "Steps";

// ---------------------------------------------------------------------------
// Item / Trigger / Panel — the recursive disclosure node. The trigger carries
// the disclosure chevron; a nested item's panel draws the rail.
// ---------------------------------------------------------------------------

type StepsItemProps = ComponentProps<typeof StepsPrimitive.Item>;

const StepsItem = (props: StepsItemProps) => <StepsPrimitive.Item {...props} />;

StepsItem.displayName = "StepsItem";

// Unopinionated trigger: hover/cursor affordances and the `steps-trigger`
// group only. Callers compose their own indicator (a right-side chevron for a
// header, an icon-that-morphs-to-chevron for a row) and read open state via
// `group-data-open/steps-trigger:`.
type StepsTriggerProps = ComponentProps<typeof StepsPrimitive.Trigger>;

const StepsTrigger = ({ className, ...props }: StepsTriggerProps) => (
  <StepsPrimitive.Trigger
    className={cn(
      "group/steps-trigger flex w-full cursor-pointer items-center gap-2 py-1 text-sm text-ink-secondary transition-colors hover:text-ink-primary",
      className,
    )}
    {...props}
  />
);

StepsTrigger.displayName = "StepsTrigger";

type StepsPanelProps = ComponentProps<typeof StepsPrimitive.Panel>;

const StepsPanel = ({ className, children, ...props }: StepsPanelProps) => (
  <StepsPrimitive.Panel
    className={cn(
      "mt-2 flex flex-col",
      // The rail: a nested item's panel indents behind a vertical line, so
      // depth reads visually without any depth counter. `[data-nested]` is set
      // by the primitive on items that sit inside another item.
      "[[data-nested]_&]:ml-2 [[data-nested]_&]:border-l [[data-nested]_&]:border-slate-6 [[data-nested]_&]:pl-4",
      className,
    )}
    {...props}
  >
    {children}
  </StepsPrimitive.Panel>
);

StepsPanel.displayName = "StepsPanel";

// ---------------------------------------------------------------------------
// Compound export
// ---------------------------------------------------------------------------

export const Steps = Object.assign(StepsRoot, {
  Item: StepsItem,
  Trigger: StepsTrigger,
  Panel: StepsPanel,
});
