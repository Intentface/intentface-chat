"use client";

import { Toggle as TogglePrimitive } from "@base-ui/react/toggle";
import { ToggleGroup as ToggleGroupPrimitive } from "@base-ui/react/toggle-group";
import { cva, type VariantProps } from "class-variance-authority";
import { createContext, use } from "react";

import { cn } from "@/lib/utils";

type ToggleGroupVariant = "default" | "segmented";

const ToggleGroupVariantContext = createContext<ToggleGroupVariant>("default");

const toggleGroupRootVariants = cva("inline-flex items-center", {
  variants: {
    variant: {
      default: "gap-1",
      // A sunken track; the pressed item rises out of it.
      segmented: "w-fit gap-0.5 rounded-full bg-base-bg p-0.5",
    },
  },
  defaultVariants: {
    variant: "default",
  },
});

const toggleGroupItemVariants = cva(
  [
    "inline-flex items-center justify-center gap-1.5 whitespace-nowrap",
    "transition-[color,background-color,box-shadow] cursor-pointer select-none",
    "focus-visible:outline-2 focus-visible:outline-accent-bg/60 focus-visible:outline-offset-1",
    "disabled:cursor-not-allowed disabled:opacity-50",
    "[&_svg]:pointer-events-none [&_svg]:shrink-0",
  ],
  {
    variants: {
      variant: {
        default: [
          "rounded-full text-ink-secondary hover:bg-ink-primary/5 hover:text-ink-primary",
          "data-pressed:bg-ink-primary/6 data-pressed:text-ink-primary",
        ],
        segmented: [
          "rounded-full text-ink-secondary hover:text-ink-primary",
          "data-pressed:bg-raised data-pressed:text-ink-primary data-pressed:shadow-raised",
        ],
      },
      size: {
        xs: "h-7 px-2.5 text-xs [&_svg:not([class*='size-'])]:size-3",
        sm: "h-8 px-3 text-sm [&_svg:not([class*='size-'])]:size-3.5",
        md: "h-9 px-3.5 text-sm [&_svg:not([class*='size-'])]:size-4",
      },
    },
    compoundVariants: [
      { variant: "segmented", size: "xs", class: "h-6 w-7 px-0" },
      { variant: "segmented", size: "sm", class: "h-7 w-8 px-0" },
      { variant: "segmented", size: "md", class: "h-8 w-9 px-0" },
    ],
    defaultVariants: {
      variant: "default",
      size: "sm",
    },
  },
);

type ToggleGroupRootProps<T extends string = string> = Omit<
  ToggleGroupPrimitive.Props<string>,
  "value" | "defaultValue" | "onValueChange"
> & {
  value?: T;
  defaultValue?: T;
  onValueChange?: (value: T | null) => void;
  variant?: ToggleGroupVariant;
};

const ToggleGroupRoot = <T extends string>({
  className,
  variant = "default",
  value,
  defaultValue,
  onValueChange,
  ...props
}: ToggleGroupRootProps<T>) => (
  <ToggleGroupVariantContext value={variant}>
    <ToggleGroupPrimitive
      data-slot="toggle-group"
      data-appearance={variant}
      className={cn(toggleGroupRootVariants({ variant }), className)}
      value={value !== undefined ? [value] : undefined}
      defaultValue={defaultValue !== undefined ? [defaultValue] : undefined}
      onValueChange={
        onValueChange ? (next) => onValueChange((next[0] as T | undefined) ?? null) : undefined
      }
      {...props}
    />
  </ToggleGroupVariantContext>
);

const ToggleGroupItem = ({
  className,
  size,
  ...props
}: TogglePrimitive.Props<string> & VariantProps<typeof toggleGroupItemVariants>) => {
  const variant = use(ToggleGroupVariantContext);

  return (
    <TogglePrimitive
      data-slot="toggle-group-item"
      className={cn(toggleGroupItemVariants({ variant, size }), className)}
      {...props}
    />
  );
};

export const ToggleGroup = Object.assign(ToggleGroupRoot, {
  Item: ToggleGroupItem,
});
