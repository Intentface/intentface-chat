"use client";

import { Switch as SwitchPrimitive } from "@base-ui/react/switch";

import { cn } from "@/lib/utils";

const Switch = ({ className, ...props }: SwitchPrimitive.Root.Props) => (
  <SwitchPrimitive.Root
    data-slot="switch"
    className={cn(
      "inline-flex h-4 w-7 shrink-0 cursor-pointer items-center rounded-full px-0.5 transition-colors",
      "bg-ink-primary/15 data-checked:bg-accent-bg",
      "focus-visible:outline-2 focus-visible:outline-accent-bg/60 focus-visible:outline-offset-2",
      "disabled:cursor-not-allowed disabled:opacity-50",
      className,
    )}
    {...props}
  >
    <SwitchPrimitive.Thumb
      data-slot="switch-thumb"
      // The thumb stays light in both themes, like a physical toggle.
      className="block size-3 rounded-full bg-white shadow-[0_0_0_0.5px_rgb(0_0_0/0.08),0_1px_2px_rgb(0_0_0/0.2),0_2px_4px_-1px_rgb(0_0_0/0.12)] transition-transform data-checked:translate-x-3"
    />
  </SwitchPrimitive.Root>
);

export { Switch };
