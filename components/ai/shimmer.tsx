"use client";

import { Shimmer as ShimmerPrimitive } from "@intentface/chat/shimmer";
import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

export type TextShimmerProps = ComponentProps<typeof ShimmerPrimitive>;

// The primitive owns the spread math (--shimmer-spread/--shimmer-duration);
// this wrapper paints the gradient and runs the intentface-shimmer keyframes.
const ShimmerComponent = ({ className, ...props }: TextShimmerProps) => (
  <ShimmerPrimitive
    className={cn(
      "relative inline-block bg-size-[250%_100%,auto] bg-clip-text text-transparent",
      "[--bg:linear-gradient(90deg,#0000_calc(50%-var(--shimmer-spread)),var(--color-background),#0000_calc(50%+var(--shimmer-spread)))] [background-repeat:no-repeat,padding-box]",
      "[background-image:var(--bg),linear-gradient(var(--color-muted-foreground),var(--color-muted-foreground))]",
      "animate-[intentface-shimmer_var(--shimmer-duration)_linear_infinite]",
      className,
    )}
    {...props}
  />
);

export const Shimmer = ShimmerComponent;
