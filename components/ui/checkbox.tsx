"use client";

import { Checkbox as CheckboxPrimitive } from "@base-ui/react/checkbox";
import { Check } from "@keyline-icons/react";

import { cn } from "@/lib/utils";

const Checkbox = ({ className, ...props }: CheckboxPrimitive.Root.Props) => (
  <CheckboxPrimitive.Root
    data-slot="checkbox"
    className={cn(
      "flex size-4 items-center justify-center rounded-[4px] bg-raised shadow-raised transition-[background-color,box-shadow]",
      "data-checked:bg-accent-raised data-checked:text-white data-checked:shadow-accent",
      "focus-visible:outline-2 focus-visible:outline-accent-bg/60 focus-visible:outline-offset-2",
      "disabled:cursor-not-allowed disabled:opacity-50",
      "peer relative shrink-0",
      className,
    )}
    {...props}
  >
    <CheckboxPrimitive.Indicator
      data-slot="checkbox-indicator"
      className="grid place-content-center text-current transition-none [&>svg]:size-3"
    >
      <Check strokeWidth={2.5} />
    </CheckboxPrimitive.Indicator>
  </CheckboxPrimitive.Root>
);

export { Checkbox };
