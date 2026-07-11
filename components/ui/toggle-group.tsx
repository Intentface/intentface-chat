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
      segmented: "w-fit gap-0 rounded-full border border-primary-border bg-primary-bg p-0.5",
    },
  },
  defaultVariants: {
    variant: "default",
  },
});

const toggleGroupItemVariants = cva(
  [
    "inline-flex items-center border border-transparent justify-center gap-1.5 whitespace-nowrap",
    "transition-colors outline-none cursor-pointer select-none",
    "focus-visible:ring-2 focus-visible:ring-accent-bg/50",
    "disabled:cursor-not-allowed disabled:opacity-50",
    "[&_svg]:pointer-events-none [&_svg]:shrink-0",
  ],
  {
    variants: {
      variant: {
        default: [
          "rounded-full text-ink-secondary hover:text-ink-primary",
          "data-pressed:bg-tertiary-bg data-pressed:text-ink-primary",
        ],
        segmented: [
          "rounded-full text-ink-tertiary shadow-none hover:text-ink-secondary",
          "data-pressed:bg-quaternary-bg data-pressed:text-ink-primary data-pressed:border-tertiary-border",
        ],
      },
      size: {
        xs: "h-7 px-2.5 text-xs [&_svg:not([class*='size-'])]:size-3",
        sm: "h-8 px-3 text-sm [&_svg:not([class*='size-'])]:size-3.5",
        md: "h-9 px-3.5 text-sm [&_svg:not([class*='size-'])]:size-4",
      },
    },
    compoundVariants: [
      { variant: "segmented", size: "xs", class: "size-7 px-0" },
      { variant: "segmented", size: "sm", class: "size-8 px-0" },
      { variant: "segmented", size: "md", class: "size-9 px-0" },
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
