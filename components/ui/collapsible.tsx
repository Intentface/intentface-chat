"use client";

import { Collapsible as BaseCollapsible } from "@base-ui/react/collapsible";
import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

type CollapsibleRootProps = ComponentProps<typeof BaseCollapsible.Root>;

const CollapsibleRoot = ({ className, ...props }: CollapsibleRootProps) => (
  <BaseCollapsible.Root className={cn(className)} {...props} />
);

type CollapsibleTriggerProps = ComponentProps<typeof BaseCollapsible.Trigger>;

const CollapsibleTrigger = ({ className, ...props }: CollapsibleTriggerProps) => (
  <BaseCollapsible.Trigger className={cn(className)} {...props} />
);

type CollapsiblePanelProps = ComponentProps<typeof BaseCollapsible.Panel>;

const CollapsiblePanel = ({ className, ...props }: CollapsiblePanelProps) => (
  <BaseCollapsible.Panel className={cn(className)} {...props} />
);

export const Collapsible = Object.assign(CollapsibleRoot, {
  Trigger: CollapsibleTrigger,
  Panel: CollapsiblePanel,
});
