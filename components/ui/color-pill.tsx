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
  className?: string;
};

export const ColorPill = ({ id, value, onValueChange, disabled, className }: ColorPillProps) => {
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
          "relative flex h-9 w-full items-center gap-2 rounded-md border border-primary-border px-2.5",
          className,
        )}
        style={{
          background: value,
          color: `oklch(from ${value} calc(round(1 - l)) 0 0)`,
        }}
      >
        <Popover.Trigger
          disabled={disabled}
          className="flex size-5 shrink-0 items-center justify-center rounded-sm outline-none transition-opacity hover:opacity-80 focus-visible:ring-2 focus-visible:ring-accent/50 disabled:cursor-not-allowed disabled:opacity-50"
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
        <ChevronDownMediumIcon className="size-3 shrink-0 opacity-70" />
      </div>
      <Popover.Content align="end" className="w-auto p-2">
        <HexColorPicker color={value} onChange={onValueChange} />
      </Popover.Content>
    </Popover>
  );
};
