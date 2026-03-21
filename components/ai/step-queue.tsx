"use client";

import { AnimatePresence, motion } from "motion/react";
import { Children, type ComponentProps, useCallback, useState } from "react";
import { TextShimmer } from "@/components/ui/text-shimmer";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const ITEM_HEIGHT = 20; // h-5
const ITEM_GAP = 8; // gap-2
const MAX_VISIBLE = 5;
const MAX_HEIGHT = MAX_VISIBLE * ITEM_HEIGHT + (MAX_VISIBLE - 1) * ITEM_GAP;

// ---------------------------------------------------------------------------
// Root
//
// Always renders all children. Single motion.div container animates height
// between one item (collapsed) and full content (expanded, capped).
// `justify-end` keeps the last item visible when collapsed.
// ---------------------------------------------------------------------------

type StepQueueRootProps = ComponentProps<"div"> & {
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
};

const StepQueueRoot = ({
  open: controlledOpen,
  defaultOpen = false,
  onOpenChange,
  className,
  children,
  ...props
}: StepQueueRootProps) => {
  const [internalOpen, setInternalOpen] = useState(defaultOpen);
  const isControlled = controlledOpen !== undefined;
  const isOpen = isControlled ? controlledOpen : internalOpen;
  const childCount = Children.count(children);
  const shouldUseMask = childCount > 1;

  const toggle = useCallback(() => {
    const next = !isOpen;
    if (!isControlled) setInternalOpen(next);
    onOpenChange?.(next);
  }, [isOpen, isControlled, onOpenChange]);

  return (
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
      className={cn(
        "not-prose relative w-full cursor-pointer p-3",
        shouldUseMask &&
          "mask-[linear-gradient(to_bottom,transparent,black_24px,black_calc(100%-24px),transparent)]",
        className,
      )}
      {...props}
    >
      <div
        className="relative flex flex-col justify-end gap-2"
        style={{ maxHeight: MAX_HEIGHT, height: isOpen ? "auto" : ITEM_HEIGHT }}
      >
        <AnimatePresence mode="popLayout" initial={false}>
          {children}
        </AnimatePresence>
      </div>
    </div>
  );
};

StepQueueRoot.displayName = "StepQueue";

// ---------------------------------------------------------------------------
// Item — animated wrapper for a single step
// ---------------------------------------------------------------------------

type StepQueueItemProps = ComponentProps<typeof motion.div>;

const StepQueueItem = ({
  className,
  children,
  ...props
}: StepQueueItemProps) => {
  return (
    <motion.div
      data-slot="step-queue-item"
      initial={{ height: 0 }}
      animate={{ height: ITEM_HEIGHT }}
      exit={{ height: 0 }}
      transition={{ duration: 0.2, type: "spring", bounce: 0 }}
      className={cn(
        "flex shrink-0 items-center text-sm font-medium text-slate-11",
        className,
      )}
      {...props}
    >
      <motion.div
        initial={{ opacity: 0, y: ITEM_HEIGHT, filter: "blur(8px)" }}
        animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
        exit={{ opacity: 0, y: -ITEM_HEIGHT, filter: "blur(8px)" }}
        transition={{ duration: 0.2, type: "spring", bounce: 0 }}
        className="flex shrink-0 items-center gap-2"
      >
        {children}
      </motion.div>
    </motion.div>
  );
};

StepQueueItem.displayName = "StepQueueItem";

// ---------------------------------------------------------------------------
// Icon — renders inside an Item, swaps between a custom icon and a default
// ---------------------------------------------------------------------------

type StepQueueIconProps = ComponentProps<"span">;

const StepQueueIcon = ({
  className,
  children,
  ...props
}: StepQueueIconProps) => {
  return (
    <span
      data-slot="step-queue-icon"
      className={cn("flex shrink-0 items-center justify-center", className)}
      {...props}
    >
      {children}
    </span>
  );
};

StepQueueIcon.displayName = "StepQueueIcon";

// ---------------------------------------------------------------------------
// Label — text content inside an Item, shimmer when active
// ---------------------------------------------------------------------------

type StepQueueLabelProps = ComponentProps<"span"> & {
  active?: boolean;
};

const StepQueueLabel = ({
  active = false,
  className,
  children,
  ...props
}: StepQueueLabelProps) => {
  return (
    <span
      data-slot="step-queue-label"
      className={cn("min-w-0 flex-1 truncate", className)}
      {...props}
    >
      {active ? <TextShimmer>{children}</TextShimmer> : children}
    </span>
  );
};

StepQueueLabel.displayName = "StepQueueLabel";

// ---------------------------------------------------------------------------
// Compound export
// ---------------------------------------------------------------------------

export const StepQueue = Object.assign(StepQueueRoot, {
  Item: StepQueueItem,
  Icon: StepQueueIcon,
  Label: StepQueueLabel,
});
