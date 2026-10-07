"use client";

import { Button as ButtonPrimitive } from "@base-ui/react/button";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  [
    "group/button inline-flex shrink-0 cursor-pointer select-none items-center justify-center whitespace-nowrap rounded-full font-medium text-sm transition-[color,background-color,box-shadow,scale] active:scale-[0.98]",
    "focus-visible:outline-2 focus-visible:outline-accent-bg/60 focus-visible:outline-offset-2",
    "disabled:pointer-events-none disabled:opacity-50",
    "[&_svg:not([class*='size-'])]:size-4 [&_svg]:pointer-events-none [&_svg]:shrink-0",
  ],
  {
    variants: {
      variant: {
        // Raised: lit from above, the default control on any surface.
        primary: "bg-raised text-ink-primary shadow-raised hover:bg-raised-hover",
        // Flat fills for secondary actions that shouldn't lift off the surface.
        secondary: "bg-base-bg text-ink-primary hover:bg-base-bg-hover",
        tertiary: "bg-tertiary-bg text-ink-primary hover:bg-tertiary-bg-hover",
        accent: "bg-accent-raised text-white shadow-accent hover:bg-accent-raised-hover",
        ghost: "text-ink-body hover:bg-ink-primary/5 hover:text-ink-primary",
        link: "text-accent-bg underline-offset-4 hover:underline",
      },
      size: {
        xs: "h-6 gap-1 px-2 text-xs has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 [&_svg:not([class*='size-'])]:size-3",
        sm: "h-7 gap-1 px-2.5 text-[0.8rem] has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 [&_svg:not([class*='size-'])]:size-3.5",
        md: "h-8 gap-1.5 px-3 has-data-[icon=inline-end]:pr-2 has-data-[icon=inline-start]:pl-2",
        lg: "h-9 gap-1.5 px-3.5 has-data-[icon=inline-end]:pr-3 has-data-[icon=inline-start]:pl-3",
        xl: "h-10 gap-2 px-4 has-data-[icon=inline-end]:pr-3 has-data-[icon=inline-start]:pl-3",
      },
    },
    defaultVariants: {
      variant: "primary",
      size: "md",
    },
  },
);

function Button({
  className,
  variant = "primary",
  size = "md",
  ...props
}: ButtonPrimitive.Props & VariantProps<typeof buttonVariants>) {
  return (
    <ButtonPrimitive
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  );
}

export default Button;
