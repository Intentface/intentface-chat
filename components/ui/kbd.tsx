"use client";

import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const kbdVariants = cva(
  "flex shrink-0 select-none items-center justify-center rounded-sm border font-medium font-sans leading-none [&_svg]:stroke-[2.5]",
  {
    variants: {
      size: {
        sm: "h-4 min-w-4 px-1 text-2xs [&>svg]:size-2.5",
        md: "h-5 min-w-5 px-1.5 text-xs [&>svg]:size-3",
        lg: "h-6 min-w-6 px-1.5 text-sm [&>svg]:size-3.5",
      },
      variant: {
        default: "border-secondary-border bg-secondary text-ink-secondary",
        frosted:
          "border-white/15 bg-white/25 text-white backdrop-blur-sm",
      },
      square: {
        true: "",
      },
    },
    compoundVariants: [
      { size: "sm", square: true, class: "w-4 px-0" },
      { size: "md", square: true, class: "w-5 px-0" },
      { size: "lg", square: true, class: "w-6 px-0" },
    ],
    defaultVariants: {
      size: "md",
      variant: "default",
      square: false,
    },
  },
);

type KbdProps = React.ComponentProps<"kbd"> & VariantProps<typeof kbdVariants>;

const Kbd = ({
  children,
  className,
  square,
  size,
  variant,
  ...props
}: KbdProps) => {
  const isSquare =
    square ?? (typeof children === "string" && children.length === 1);

  return (
    <kbd
      data-slot="kbd"
      className={cn(kbdVariants({ size, square: isSquare, variant }), className)}
      {...props}
    >
      {children}
    </kbd>
  );
};

export { Kbd };
