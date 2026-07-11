"use client";

import { useCallback, useState } from "react";
import { HexColorPicker } from "react-colorful";

import { ChevronDownMediumIcon } from "@/components/icons/chevron-down-medium";
import { EyedropperIcon } from "@/components/icons/eyedropper";
import { Popover } from "@/components/ui/popover";
import { HexSchema } from "@/lib/interface-theme";
import { cn } from "@/lib/utils";

type ColorPillProps = {
  id?: string;
  value: string;
  onValueChange: (next: string) => void;
  disabled?: boolean;
  size?: "default" | "compact";
  className?: string;
};

const colorPillSizes = {
  default: "box-border h-9 w-full px-2.5",
  compact: "box-border h-8 w-28 shrink-0 px-2",
} as const;

export const ColorPill = ({
  id,
  value,
  onValueChange,
  disabled,
  size = "default",
  className,
}: ColorPillProps) => {
  const [draft, setDraft] = useState<string | null>(null);

  const handleBlur = useCallback(() => {
    if (draft === null) return;
    const result = HexSchema.safeParse(draft);
    if (result.success) onValueChange(result.data);
    setDraft(null);
  }, [draft, onValueChange]);

  return (
    <Popover>
      <div
        className={cn(
          "relative flex items-center gap-1.5 rounded-md border border-primary-border",
          colorPillSizes[size],
          className,
        )}
        style={{
          background: value,
          color: `oklch(from ${value} calc(round(1 - l)) 0 0)`,
        }}
      >
        <Popover.Trigger
          disabled={disabled}
          className="flex size-5 shrink-0 items-center justify-center rounded-sm outline-none transition-opacity hover:opacity-80 focus-visible:ring-2 focus-visible:ring-accent-bg/50 disabled:cursor-not-allowed disabled:opacity-50"
          aria-label="Pick color"
        >
          <EyedropperIcon className="size-3.5" />
        </Popover.Trigger>
        <input
          id={id}
          value={draft ?? value}
          onChange={(event) => setDraft(event.target.value)}
          onBlur={handleBlur}
          disabled={disabled}
          spellCheck={false}
          className="flex-1 bg-transparent font-mono text-xs uppercase outline-none disabled:cursor-not-allowed disabled:opacity-50"
        />
        <ChevronDownMediumIcon
          className={cn("size-3 shrink-0 opacity-70", size === "compact" && "hidden")}
        />
      </div>
      <Popover.Content align="end" className="w-auto p-2">
        <HexColorPicker color={value} onChange={onValueChange} />
      </Popover.Content>
    </Popover>
  );
};
