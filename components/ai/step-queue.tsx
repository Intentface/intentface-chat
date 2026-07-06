"use client";

import { StepQueue as StepQueuePrimitive, useStepQueue } from "@intentface/chat/step-queue";
import { AnimatePresence, motion } from "motion/react";
import { Children, type ComponentProps, type ReactNode } from "react";
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
// Always renders all children. The inner container animates height between one
// item (collapsed) and full content (expanded, capped). `justify-end` keeps
// the last item visible when collapsed. Open state comes from the primitive.
// ---------------------------------------------------------------------------

type StepQueueRootProps = ComponentProps<typeof StepQueuePrimitive>;

const StepQueueHeightContainer = ({ children }: { children: ReactNode }) => {
  const { isOpen } = useStepQueue();

  return (
    <div
      className="relative flex flex-col justify-end gap-2"
      style={{ maxHeight: MAX_HEIGHT, height: isOpen ? "auto" : ITEM_HEIGHT }}
    >
      <AnimatePresence mode="popLayout" initial={false}>
        {children}
      </AnimatePresence>
    </div>
  );
};

const StepQueueRoot = ({ className, children, ...props }: StepQueueRootProps) => {
  const shouldUseMask = Children.count(children) > 1;

  return (
    <StepQueuePrimitive
      className={cn(
        "not-prose relative w-full cursor-pointer p-3",
        shouldUseMask &&
          "mask-[linear-gradient(to_bottom,transparent,black_24px,black_calc(100%-24px),transparent)]",
        className,
      )}
      {...props}
    >
      <StepQueueHeightContainer>{children}</StepQueueHeightContainer>
    </StepQueuePrimitive>
  );
};

StepQueueRoot.displayName = "StepQueue";

// ---------------------------------------------------------------------------
// Item — animated wrapper for a single step
// ---------------------------------------------------------------------------

type StepQueueItemProps = ComponentProps<typeof motion.div>;

const StepQueueItem = ({ className, children, ...props }: StepQueueItemProps) => {
  return (
    <motion.div
      data-slot="step-queue-item"
      initial={{ height: 0 }}
      animate={{ height: ITEM_HEIGHT }}
      exit={{ height: 0 }}
      transition={{
        duration: 0.2,
        type: "spring",
        bounce: 0,
      }}
      className={cn("flex shrink-0 items-center text-sm font-medium text-ink-secondary", className)}
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

type StepQueueIconProps = ComponentProps<typeof StepQueuePrimitive.Icon>;

const StepQueueIcon = ({ className, ...props }: StepQueueIconProps) => (
  <StepQueuePrimitive.Icon
    className={cn("flex shrink-0 items-center justify-center", className)}
    {...props}
  />
);

StepQueueIcon.displayName = "StepQueueIcon";

// ---------------------------------------------------------------------------
// Label — text content inside an Item, shimmer when active
// ---------------------------------------------------------------------------

type StepQueueLabelProps = ComponentProps<typeof StepQueuePrimitive.Label>;

const StepQueueLabel = ({ active = false, className, children, ...props }: StepQueueLabelProps) => (
  <StepQueuePrimitive.Label
    active={active}
    className={cn("min-w-0 flex-1 truncate", className)}
    {...props}
  >
    {active ? <TextShimmer>{children}</TextShimmer> : children}
  </StepQueuePrimitive.Label>
);

StepQueueLabel.displayName = "StepQueueLabel";

// ---------------------------------------------------------------------------
// Compound export
// ---------------------------------------------------------------------------

export const StepQueue = Object.assign(StepQueueRoot, {
  Item: StepQueueItem,
  Icon: StepQueueIcon,
  Label: StepQueueLabel,
});
