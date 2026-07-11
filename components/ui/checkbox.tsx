"use client";

import { Checkbox as CheckboxPrimitive } from "@base-ui/react/checkbox";

import { CheckMarkMediumIcon } from "@/components/icons/check-mark-medium";
import { cn } from "@/lib/utils";

const Checkbox = ({ className, ...props }: CheckboxPrimitive.Root.Props) => (
  <CheckboxPrimitive.Root
    data-slot="checkbox"
    className={cn(
      "flex size-4 items-center justify-center rounded-[4px] border border-tertiary-border bg-tertiary-bg transition-colors",
      "data-checked:bg-tertiary-bg-active data-checked:text-ink-primary",
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
      <CheckMarkMediumIcon />
    </CheckboxPrimitive.Indicator>
  </CheckboxPrimitive.Root>
);

export { Checkbox };
