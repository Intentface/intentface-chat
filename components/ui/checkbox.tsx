"use client";

import { Checkbox as CheckboxPrimitive } from "@base-ui/react/checkbox";
import { CheckIcon } from "lucide-react";

import { cn } from "@/lib/utils";

const Checkbox = ({ className, ...props }: CheckboxPrimitive.Root.Props) => (
  <CheckboxPrimitive.Root
    data-slot="checkbox"
    className={cn(
      "flex size-4 items-center justify-center rounded-[4px] border border-slate-9 bg-slate-5 transition-colors",
      "data-checked:border-slate-12 data-checked:bg-slate-12 data-checked:text-slate-1",
      "focus-visible:ring-2 focus-visible:ring-slate-8 focus-visible:outline-none",
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
      <CheckIcon />
    </CheckboxPrimitive.Indicator>
  </CheckboxPrimitive.Root>
);

export { Checkbox };
