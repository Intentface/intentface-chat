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
    className={cn("h-1 w-full rounded-full bg-ink-primary/15", className)}
    {...props}
  />
);

const SliderIndicator = ({
  className,
  ...props
}: React.ComponentProps<typeof SliderPrimitive.Indicator>) => (
  <SliderPrimitive.Indicator className={cn("rounded-full bg-accent-bg", className)} {...props} />
);

const SliderThumb = ({
  className,
  ...props
}: React.ComponentProps<typeof SliderPrimitive.Thumb>) => (
  <SliderPrimitive.Thumb
    className={cn(
      "size-4 rounded-full bg-white shadow-[0_0_0_0.5px_rgb(0_0_0/0.08),0_1px_2px_rgb(0_0_0/0.2),0_2px_4px_-1px_rgb(0_0_0/0.12)]",
      "focus-visible:outline-2 focus-visible:outline-accent-bg/60 focus-visible:outline-offset-2",
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
