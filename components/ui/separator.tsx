"use client";

import { Separator as SeparatorPrimitive } from "@base-ui/react/separator";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const separatorVariants = cva("bg-slate-7 shrink-0", {
  variants: {
    type: {
      line: "data-[orientation=horizontal]:h-px data-[orientation=horizontal]:w-full data-[orientation=vertical]:w-px data-[orientation=vertical]:self-stretch",
      dot: "size-1 rounded-full",
    },
  },
  defaultVariants: {
    type: "line",
  },
});

function Separator({
  className,
  type = "line",
  ...props
}: SeparatorPrimitive.Props & VariantProps<typeof separatorVariants>) {
  return (
    <SeparatorPrimitive
      data-slot="separator"
      className={cn(separatorVariants({ type }), className)}
      {...props}
    />
  );
}

export default Separator;
