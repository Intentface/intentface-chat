import type * as React from "react";

import { cn } from "@/lib/utils";

function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        "flex field-sizing-content min-h-16 w-full rounded-[7px] bg-primary-bg px-2.5 py-2 text-base text-ink-primary shadow-card transition-shadow md:text-sm",
        "placeholder:text-ink-tertiary",
        "focus-visible:outline-2 focus-visible:outline-accent-bg/60 focus-visible:outline-offset-1",
        "aria-invalid:outline-2 aria-invalid:outline-red-500/60",
        "disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      {...props}
    />
  );
}

export default Textarea;
