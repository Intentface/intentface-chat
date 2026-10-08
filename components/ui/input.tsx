import { Input as InputPrimitive } from "@base-ui/react/input";
import type * as React from "react";

import { cn } from "@/lib/utils";

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <InputPrimitive
      type={type}
      data-slot="input"
      className={cn(
        // Fields are rounded squares with the crisp card ring.
        "h-8 w-full min-w-0 rounded-[7px] bg-primary-bg px-2.5 py-1 text-base text-ink-primary shadow-card transition-shadow md:text-sm",
        "placeholder:text-ink-tertiary",
        "focus-visible:outline-2 focus-visible:outline-accent-bg/60 focus-visible:outline-offset-1",
        "aria-invalid:outline-2 aria-invalid:outline-red-500/60",
        "file:inline-flex file:h-6 file:border-0 file:bg-transparent file:font-medium file:text-ink-primary file:text-sm",
        "disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      {...props}
    />
  );
}

export default Input;
