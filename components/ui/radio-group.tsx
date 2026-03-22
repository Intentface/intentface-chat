"use client";

import { Radio as RadioPrimitive } from "@base-ui/react/radio";
import { RadioGroup as RadioGroupPrimitive } from "@base-ui/react/radio-group";

import { cn } from "@/lib/utils";

const RadioGroup = ({ className, ...props }: RadioGroupPrimitive.Props) => (
  <RadioGroupPrimitive
    data-slot="radio-group"
    className={cn("w-full gap-2", className)}
    {...props}
  />
);

const RadioGroupItem = ({ className, ...props }: RadioPrimitive.Root.Props) => (
  <RadioPrimitive.Root
    data-slot="radio-group-item"
    className={cn(
      "relative flex aspect-square size-3.5 shrink-0 rounded-full border border-slate-9 bg-slate-5 transition-colors",
      "data-checked:border-slate-12 data-checked:bg-slate-12",
      "focus-visible:ring-2 focus-visible:ring-slate-8 focus-visible:outline-none",
      "disabled:cursor-not-allowed disabled:opacity-50",
      "peer",
      className,
    )}
    {...props}
  >
    <RadioPrimitive.Indicator
      data-slot="radio-group-indicator"
      className="flex size-full items-center justify-center shrink-0"
    >
      <span className="size-1.5 shrink-0 rounded-full bg-slate-1" />
    </RadioPrimitive.Indicator>
  </RadioPrimitive.Root>
);

export { RadioGroup, RadioGroupItem };
