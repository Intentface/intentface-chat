"use client";

import { useCallback, useState } from "react";
import { HexColorPicker } from "react-colorful";

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
  default: "h-9 w-full pr-2.5 pl-2",
  compact: "h-7 w-[5.75rem] shrink-0 pr-2 pl-1.5",
} as const;

// A raised field: the swatch opens the picker, the hex text is editable.
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
          "relative flex items-center gap-2 rounded-[7px] bg-raised shadow-raised",
          colorPillSizes[size],
          className,
        )}
      >
        <Popover.Trigger
          disabled={disabled}
          className="size-4 shrink-0 cursor-pointer rounded-[4px] shadow-[inset_0_0_0_1px_rgb(0_0_0/0.12)] transition-opacity hover:opacity-85 focus-visible:outline-2 focus-visible:outline-accent-bg/60 focus-visible:outline-offset-2 disabled:cursor-not-allowed disabled:opacity-50 dark:shadow-[inset_0_0_0_1px_rgb(255_255_255/0.14)]"
          style={{ background: value }}
          aria-label="Pick color"
        />
        <input
          id={id}
          value={(draft ?? value).replace(/^#/, "")}
          onChange={(event) => setDraft(event.target.value)}
          onBlur={handleBlur}
          disabled={disabled}
          spellCheck={false}
          aria-label="Hex color"
          className="w-full min-w-0 flex-1 bg-transparent font-mono text-ink-body text-xs uppercase outline-none disabled:cursor-not-allowed disabled:opacity-50"
        />
      </div>
      <Popover.Content align="end" className="w-auto p-2">
        <HexColorPicker color={value} onChange={onValueChange} />
      </Popover.Content>
    </Popover>
  );
};
