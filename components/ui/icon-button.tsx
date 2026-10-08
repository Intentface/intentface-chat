"use client";

import { Button as ButtonPrimitive } from "@base-ui/react/button";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const iconButtonVariants = cva(
  [
    "group/button inline-flex shrink-0 cursor-pointer select-none items-center justify-center rounded-full font-medium transition-[color,background-color,box-shadow,scale] active:scale-[0.97]",
    "focus-visible:outline-2 focus-visible:outline-accent-bg/60 focus-visible:outline-offset-2",
    "disabled:pointer-events-none disabled:opacity-50",
    "[&_svg:not([class*='size-'])]:size-4 [&_svg]:pointer-events-none [&_svg]:shrink-0",
  ],
  {
    variants: {
      variant: {
        primary:
          "bg-raised text-ink-body shadow-raised hover:bg-raised-hover hover:text-ink-primary",
        secondary: "bg-base-bg text-ink-secondary hover:bg-base-bg-hover hover:text-ink-primary",
        tertiary:
          "bg-tertiary-bg text-ink-secondary hover:bg-tertiary-bg-hover hover:text-ink-primary",
        accent: "bg-accent-raised text-white shadow-accent hover:bg-accent-raised-hover",
        ghost:
          "text-ink-secondary hover:bg-ink-primary/5 hover:text-ink-primary aria-expanded:bg-ink-primary/5 aria-expanded:text-ink-primary",
        link: "text-accent-bg underline-offset-4 hover:underline",
      },
      size: {
        "2xs": "size-4 [&_svg:not([class*='size-'])]:size-2.5",
        xs: "size-6 [&_svg:not([class*='size-'])]:size-3",
        sm: "size-7 [&_svg:not([class*='size-'])]:size-3.5",
        md: "size-8 [&_svg:not([class*='size-'])]:size-4",
        lg: "size-9 [&_svg:not([class*='size-'])]:size-4.5",
        xl: "size-10 [&_svg:not([class*='size-'])]:size-5",
      },
    },
    defaultVariants: {
      variant: "primary",
      size: "md",
    },
  },
);

function IconButton({
  className,
  variant = "primary",
  size = "md",
  ...props
}: ButtonPrimitive.Props & VariantProps<typeof iconButtonVariants>) {
  return (
    <ButtonPrimitive
      data-slot="button"
      className={cn(iconButtonVariants({ variant, size, className }))}
      {...props}
    />
  );
}

export { IconButton, iconButtonVariants };
