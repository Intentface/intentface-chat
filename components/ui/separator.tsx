"use client";

import { Separator as SeparatorPrimitive } from "@base-ui/react/separator";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const separatorVariants = cva("bg-border shrink-0", {
  variants: {
    type: {
      line: "data-horizontal:h-px data-horizontal:w-full data-vertical:w-px data-vertical:self-stretch",
      dot: "size-1 rounded-full",
    },
  },
  defaultVariants: {
    type: "line",
  },
});

function Separator({
  className,
  orientation = "horizontal",
  type = "line",
  ...props
}: SeparatorPrimitive.Props & VariantProps<typeof separatorVariants>) {
  return (
    <SeparatorPrimitive
      data-slot="separator"
      orientation={orientation}
      className={cn(separatorVariants({ type }), className)}
      {...props}
    />
  );
}

export default Separator;
