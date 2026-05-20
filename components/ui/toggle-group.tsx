"use client";

import { Toggle as TogglePrimitive } from "@base-ui/react/toggle";
import { ToggleGroup as ToggleGroupPrimitive } from "@base-ui/react/toggle-group";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const toggleGroupItemVariants = cva(
  [
    "inline-flex items-center justify-center gap-1.5 whitespace-nowrap",
    "rounded-full transition-colors outline-none cursor-pointer select-none",
    "text-ink-secondary hover:text-ink-primary",
    "data-pressed:bg-tertiary data-pressed:text-ink-primary",
    "focus-visible:ring-2 focus-visible:ring-accent/50",
    "disabled:cursor-not-allowed disabled:opacity-50",
    "[&_svg]:pointer-events-none [&_svg]:shrink-0",
  ],
  {
    variants: {
      size: {
        xs: "h-7 px-2.5 text-xs [&_svg:not([class*='size-'])]:size-3",
        sm: "h-8 px-3 text-sm [&_svg:not([class*='size-'])]:size-3.5",
        md: "h-9 px-3.5 text-sm [&_svg:not([class*='size-'])]:size-4",
      },
    },
    defaultVariants: {
      size: "sm",
    },
  },
);

type ToggleGroupRootProps<Value extends string> = Omit<
  ToggleGroupPrimitive.Props<Value>,
  "value" | "defaultValue" | "onValueChange"
> & {
  value?: Value;
  defaultValue?: Value;
  onValueChange?: (value: Value | null) => void;
};

const ToggleGroupRoot = <Value extends string>({
  className,
  value,
  defaultValue,
  onValueChange,
  ...props
}: ToggleGroupRootProps<Value>) => (
  <ToggleGroupPrimitive
    data-slot="toggle-group"
    className={cn("inline-flex items-center gap-1", className)}
    value={value !== undefined ? [value] : undefined}
    defaultValue={defaultValue !== undefined ? [defaultValue] : undefined}
    onValueChange={
      onValueChange
        ? (next) => onValueChange((next[0] as Value | undefined) ?? null)
        : undefined
    }
    {...props}
  />
);

const ToggleGroupItem = ({
  className,
  size,
  ...props
}: TogglePrimitive.Props<string> &
  VariantProps<typeof toggleGroupItemVariants>) => (
  <TogglePrimitive
    data-slot="toggle-group-item"
    className={cn(toggleGroupItemVariants({ size, className }))}
    {...props}
  />
);

export const ToggleGroup = Object.assign(ToggleGroupRoot, {
  Item: ToggleGroupItem,
});
