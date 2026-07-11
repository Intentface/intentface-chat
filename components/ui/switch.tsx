"use client";

import { Switch as SwitchPrimitive } from "@base-ui/react/switch";

import { cn } from "@/lib/utils";

const Switch = ({ className, ...props }: SwitchPrimitive.Root.Props) => (
  <SwitchPrimitive.Root
    data-slot="switch"
    className={cn(
      "inline-flex h-4 w-7 shrink-0 cursor-pointer items-center rounded-full px-0.5 transition-colors",
      "bg-base data-checked:bg-accent",
      "focus-visible:ring-2 focus-visible:ring-accent/50 focus-visible:outline-none",
      "disabled:cursor-not-allowed disabled:opacity-50",
      className,
    )}
    {...props}
  >
    <SwitchPrimitive.Thumb
      data-slot="switch-thumb"
      className="block size-3 rounded-full bg-primary shadow-xs transition-transform data-checked:translate-x-3"
    />
  </SwitchPrimitive.Root>
);

export { Switch };
