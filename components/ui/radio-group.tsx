"use client";

import { Radio as RadioPrimitive } from "@base-ui/react/radio";
import { RadioGroup as RadioGroupPrimitive } from "@base-ui/react/radio-group";

import { cn } from "@/lib/utils";

const RadioGroupRoot = ({ className, ...props }: RadioGroupPrimitive.Props) => (
  <RadioGroupPrimitive
    data-slot="radio-group"
    className={cn("w-full gap-2", className)}
    {...props}
  />
);

const RadioGroupItem = ({ className, children, ...props }: RadioPrimitive.Root.Props) => (
  <RadioPrimitive.Root
    data-slot="radio-group-item"
    className={cn(
      "relative flex items-center justify-center aspect-square size-4 shrink-0 rounded-full bg-raised shadow-raised transition-[background-color,box-shadow]",
      "data-checked:bg-accent-raised data-checked:shadow-accent",
      "focus-visible:outline-2 focus-visible:outline-accent-bg/60 focus-visible:outline-offset-2",
      "disabled:cursor-not-allowed disabled:opacity-50",
      "peer",
      className,
    )}
    {...props}
  >
    {children ?? (
      <RadioPrimitive.Indicator
        data-slot="radio-group-indicator"
        className="flex size-full items-center justify-center shrink-0"
      >
        <span className="size-1.5 shrink-0 rounded-full bg-white" />
      </RadioPrimitive.Indicator>
    )}
  </RadioPrimitive.Root>
);

const RadioGroup = Object.assign(RadioGroupRoot, {
  Item: RadioGroupItem,
});

export { RadioGroup };
