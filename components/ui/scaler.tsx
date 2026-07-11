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
  size?: "default" | "compact";
  className?: string;
};

const scalerSizes = {
  default: "box-border h-9 w-full",
  compact:
    "box-border m-0 h-8 w-28 shrink-0 overflow-hidden rounded-md border border-primary-border p-0",
} as const;

export const Scaler = ({
  value,
  onValueChange,
  min,
  max,
  step,
  tickStep,
  disabled,
  size = "default",
  className,
}: ScalerProps) => {
  const tickCount = !tickStep ? 0 : Math.max(0, Math.floor((max - min) / tickStep) - 1);

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
      className={cn("group relative touch-none", scalerSizes[size], className)}
    >
      <SliderPrimitive.Control className="relative flex h-full w-full items-stretch">
        <SliderPrimitive.Track
          className={cn(
            "relative h-full w-full overflow-hidden bg-base-bg",
            size === "default" && "rounded-md",
          )}
        >
          {tickCount > 0 && (
            <div
              className={cn(
                "pointer-events-none absolute z-0 flex items-stretch justify-between",
                size === "compact" ? "inset-x-1.5 inset-y-2 pr-7" : "inset-x-3 inset-y-2.5",
              )}
            >
              {Array.from({ length: tickCount }, (_, i) => (
                <span key={i} className="w-px bg-ink-primary/15" />
              ))}
            </div>
          )}
          <SliderPrimitive.Indicator className="rounded-none bg-ink-primary/10" />
          <SliderPrimitive.Thumb className="h-4 w-0.5 rounded-full border-0 bg-ink-primary opacity-0 shadow-none transition-opacity group-hover:opacity-80 focus-visible:opacity-100 data-active:opacity-100" />
        </SliderPrimitive.Track>
      </SliderPrimitive.Control>
      <div
        className={cn(
          "pointer-events-none absolute inset-0 z-10 flex items-center justify-end",
          size === "compact" ? "px-2" : "px-3",
        )}
      >
        <span
          className={cn(
            "tabular-nums text-ink-secondary",
            size === "compact" ? "text-xs" : "text-sm",
          )}
        >
          {value.toFixed(2)}
        </span>
      </div>
    </SliderPrimitive.Root>
  );
};
