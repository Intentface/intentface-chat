"use client";

import { Slider as SliderPrimitive } from "@base-ui/react/slider";

import { cn } from "@/lib/utils";

type ScalerProps = {
  value: number;
  onValueChange: (value: number) => void;
  min: number;
  max: number;
  step: number;
  tickStep?: number;
  disabled?: boolean;
  className?: string;
};

export const Scaler = ({
  value,
  onValueChange,
  min,
  max,
  step,
  tickStep,
  disabled,
  className,
}: ScalerProps) => {
  const tickCount = tickStep
    ? Math.max(0, Math.floor((max - min) / tickStep) - 1)
    : 0;

  const handleValueChange = (next: number | readonly number[]) => {
    const value = typeof next === "number" ? next : next[0];
    onValueChange(value);
  };

  return (
    <SliderPrimitive.Root
      value={value}
      onValueChange={handleValueChange}
      min={min}
      max={max}
      step={step}
      disabled={disabled}
      className={cn("group relative h-9 w-full touch-none", className)}
    >
      <SliderPrimitive.Control className="relative flex h-full w-full items-stretch">
        <SliderPrimitive.Track className="relative h-full w-full overflow-hidden rounded-md bg-base">
          {tickCount > 0 && (
            <div className="pointer-events-none absolute inset-x-3 inset-y-2.5 z-0 flex items-stretch justify-between">
              {Array.from({ length: tickCount }, (_, i) => (
                <span key={i} className="w-px bg-ink-primary/15" />
              ))}
            </div>
          )}
          <SliderPrimitive.Indicator className="rounded-none bg-ink-primary/10" />
          <SliderPrimitive.Thumb className="h-full w-1 rounded-full border-0 bg-ink-primary opacity-0 shadow-none transition-opacity group-hover:opacity-80 focus-visible:opacity-100 data-[active]:opacity-100" />
        </SliderPrimitive.Track>
      </SliderPrimitive.Control>
      <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-end px-3">
        <span className="text-sm tabular-nums text-ink-secondary">
          {value.toFixed(2)}
        </span>
      </div>
    </SliderPrimitive.Root>
  );
};
