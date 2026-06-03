"use client";

import { Slider as SliderPrimitive } from "@base-ui/react/slider";
import type * as React from "react";

import { cn } from "@/lib/utils";

const SliderRoot = ({ className, ...props }: React.ComponentProps<typeof SliderPrimitive.Root>) => (
  <SliderPrimitive.Root
    className={cn("flex w-full touch-none items-center gap-3", className)}
    {...props}
  />
);

const SliderControl = ({
  className,
  ...props
}: React.ComponentProps<typeof SliderPrimitive.Control>) => (
  <SliderPrimitive.Control className={cn("flex h-5 w-full items-center", className)} {...props} />
);

const SliderTrack = ({
  className,
  ...props
}: React.ComponentProps<typeof SliderPrimitive.Track>) => (
  <SliderPrimitive.Track
    className={cn("h-1 w-full rounded-full bg-base-active", className)}
    {...props}
  />
);

const SliderIndicator = ({
  className,
  ...props
}: React.ComponentProps<typeof SliderPrimitive.Indicator>) => (
  <SliderPrimitive.Indicator className={cn("rounded-full bg-accent", className)} {...props} />
);

const SliderThumb = ({
  className,
  ...props
}: React.ComponentProps<typeof SliderPrimitive.Thumb>) => (
  <SliderPrimitive.Thumb
    className={cn(
      "h-4 w-6 rounded-full border-2 border-accent bg-primary shadow-sm",
      "focus-visible:ring-2 focus-visible:ring-accent/50 focus-visible:outline-none",
      className,
    )}
    {...props}
  />
);

const SliderValue = ({
  className,
  ...props
}: React.ComponentProps<typeof SliderPrimitive.Value>) => (
  <SliderPrimitive.Value
    className={cn("text-sm tabular-nums text-ink-secondary", className)}
    {...props}
  />
);

export const Slider = Object.assign(SliderRoot, {
  Control: SliderControl,
  Track: SliderTrack,
  Indicator: SliderIndicator,
  Thumb: SliderThumb,
  Value: SliderValue,
});
