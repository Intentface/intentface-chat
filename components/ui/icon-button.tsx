"use client";

import { Button as ButtonPrimitive } from "@base-ui/react/button";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const iconButtonVariants = cva(
  "focus-visible:border-ring focus-visible:ring-ring/50 aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive dark:aria-invalid:border-destructive/50 rounded-lg border border-transparent bg-clip-padding font-medium focus-visible:ring-3 aria-invalid:ring-3 [&_svg:not([class*='size-'])]:size-4 inline-flex items-center justify-center transition-all disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none shrink-0 [&_svg]:shrink-0 outline-none group/button select-none active:scale-x-[0.99] cursor-pointer",
  {
    variants: {
      variant: {
        default: "bg-slate-1 border-slate-7 text-slate-12 hover:bg-slate-4",
        outline:
          "border-border bg-transparent border-slate-6 hover:text-foreground aria-expanded:bg-muted aria-expanded:text-foreground",
        secondary:
          "bg-secondary text-secondary-foreground hover:bg-secondary/80 aria-expanded:bg-secondary aria-expanded:text-secondary-foreground",
        ghost:
          "hover:bg-slate-4 hover:slate-12 aria-expanded:bg-muted aria-expanded:text-foreground",
        link: "text-slate-12 underline-offset-4 hover:underline",
      },
      size: {
        xs: "size-6 rounded-[min(var(--radius-md),10px)] in-data-[slot=button-group]:rounded-lg [&_svg:not([class*='size-'])]:size-3",
        sm: "size-7 rounded-[min(var(--radius-md),12px)] in-data-[slot=button-group]:rounded-lg [&_svg:not([class*='size-'])]:size-3.5",
        md: "size-8 [&_svg:not([class*='size-'])]:size-4",
        lg: "size-9 [&_svg:not([class*='size-'])]:size-4.5",
        xl: "size-10 [&_svg:not([class*='size-'])]:size-5",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "md",
    },
  },
);

function IconButton({
  className,
  variant = "default",
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
