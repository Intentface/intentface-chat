"use client";

import { useTheme } from "next-themes";
import { useCallback, useRef, useState } from "react";
import { Dialog } from "@/components/ui/dialog";
import { Slider } from "@/components/ui/slider";
import type { ThemeMode, ThemeOverrides } from "@/lib/store/settings";
import { useSettingsStore } from "@/lib/store/settings";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Defaults (must match globals.css :root / .dark)
// ---------------------------------------------------------------------------

const DEFAULTS: Record<ThemeMode, Required<ThemeOverrides>> = {
  light: { bg: "#ffffff", fg: "#1a1a1a", acc: "#0169cc", con: 0.35 },
  dark: { bg: "#111111", fg: "#fcfcfc", acc: "#4a9eed", con: 0.35 },
};

// ---------------------------------------------------------------------------
// ColorRow — swatch + hex input
// ---------------------------------------------------------------------------

type ColorRowProps = {
  label: string;
  value: string;
  onChange: (value: string) => void;
};

const HEX_RE = /^#[0-9a-f]{6}$/i;

const ColorRow = ({ label, value, onChange }: ColorRowProps) => {
  const [draft, setDraft] = useState(value);
  const colorInputRef = useRef<HTMLInputElement>(null);

  // Sync draft when external value changes (e.g. reset)
  const previousValue = useRef(value);
  if (previousValue.current !== value) {
    previousValue.current = value;
    if (draft !== value) setDraft(value);
  }

  const commit = (hex: string) => {
    if (HEX_RE.test(hex)) {
      onChange(hex.toLowerCase());
    }
  };

  return (
    <div className="flex h-10 items-center justify-between">
      <span className="text-sm text-ink-secondary">{label}</span>
      <div className="flex items-center gap-2">
        <button
          type="button"
          className="size-6 rounded-md border border-primary-border"
          style={{ backgroundColor: value }}
          onClick={() => colorInputRef.current?.click()}
          aria-label={`Pick ${label} color`}
        />
        <input
          ref={colorInputRef}
          type="color"
          value={value}
          onChange={(event) => {
            const hex = event.target.value;
            setDraft(hex);
            commit(hex);
          }}
          className="sr-only"
          tabIndex={-1}
        />
        <input
          type="text"
          value={draft}
          onChange={(event) => {
            const hex = event.target.value;
            setDraft(hex);
            commit(hex);
          }}
          onBlur={() => {
            if (!HEX_RE.test(draft)) setDraft(value);
          }}
          spellCheck={false}
          className={cn(
            "h-7 w-24 rounded-md border border-primary-border bg-primary px-2 font-mono text-xs text-ink-primary",
            "focus:outline-none focus:ring-2 focus:ring-accent/50",
          )}
        />
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------------
// ContrastRow — slider + numeric display
// ---------------------------------------------------------------------------

type ContrastRowProps = {
  value: number;
  onChange: (value: number) => void;
};

const TICK_COUNT = 5;

const ContrastRow = ({ value, onChange }: ContrastRowProps) => {
  const displayValue = Math.round(value * 100);

  const handleValueChange = (newValue: number | readonly number[]) => {
    const val = typeof newValue === "number" ? newValue : newValue[0];
    onChange(val / 100);
  };

  return (
    <div className="flex h-10 items-center justify-between">
      <span className="text-sm text-ink-secondary">Contrast</span>
      <div className="group relative w-32">
        <Slider
          value={displayValue}
          onValueChange={handleValueChange}
          min={15}
          max={85}
          step={1}
          className="h-8 gap-0"
        >
          <Slider.Control className="h-full w-full">
            <Slider.Track className="relative h-full w-full overflow-hidden rounded-lg bg-base">
              <div className="pointer-events-none absolute inset-x-2.5 inset-y-2.5 z-0 flex items-stretch justify-between">
                {Array.from({ length: TICK_COUNT }, (_, i) => (
                  <span key={i} className="w-px bg-ink-primary/20" />
                ))}
              </div>
              <Slider.Indicator className="rounded-none bg-ink-primary/10" />
              <Slider.Thumb className="h-6 w-1 rounded-full border-0 bg-ink-primary opacity-0 shadow-none transition-opacity group-hover:opacity-100 focus-visible:opacity-100 data-[active]:opacity-100" />
            </Slider.Track>
          </Slider.Control>
        </Slider>
        <div className="pointer-events-none absolute inset-0 flex items-center justify-end px-2.5">
          <span className="text-sm tabular-nums text-ink-secondary">
            {(displayValue / 100).toFixed(2)}
          </span>
        </div>
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------------
// ModeTabs
// ---------------------------------------------------------------------------

type ModeTabsProps = {
  value: ThemeMode;
  onChange: (mode: ThemeMode) => void;
};

const ModeTabs = ({ value, onChange }: ModeTabsProps) => (
  <div className="flex gap-1 rounded-lg bg-base p-1">
    {(["light", "dark"] as const).map((mode) => (
      <button
        key={mode}
        type="button"
        onClick={() => onChange(mode)}
        className={cn(
          "rounded-md px-3 py-1 text-xs font-medium capitalize transition-colors",
          value === mode
            ? "bg-primary text-ink-primary shadow-sm"
            : "text-ink-tertiary hover:text-ink-secondary",
        )}
      >
        {mode}
      </button>
    ))}
  </div>
);

// ---------------------------------------------------------------------------
// ThemeConfigurator
// ---------------------------------------------------------------------------

type ThemeConfiguratorProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export const ThemeConfigurator = ({
  open,
  onOpenChange,
}: ThemeConfiguratorProps) => {
  const { resolvedTheme } = useTheme();
  const { themeOverrides, setThemeOverride, resetThemeOverrides } =
    useSettingsStore();

  const [editingMode, setEditingMode] = useState<ThemeMode>(
    (resolvedTheme as ThemeMode) ?? "light",
  );

  // Sync editing mode when theme changes
  const previousResolvedTheme = useRef(resolvedTheme);
  if (previousResolvedTheme.current !== resolvedTheme) {
    previousResolvedTheme.current = resolvedTheme;
    setEditingMode((resolvedTheme as ThemeMode) ?? "light");
  }

  const overrides = themeOverrides[editingMode] ?? {};
  const defaults = DEFAULTS[editingMode];

  const getValue = useCallback(
    (key: keyof ThemeOverrides) => {
      const value = overrides[key];
      return value !== undefined ? String(value) : String(defaults[key]);
    },
    [overrides, defaults],
  );

  const handleColorChange = useCallback(
    (key: keyof ThemeOverrides) => (value: string) => {
      setThemeOverride(editingMode, key, value);
    },
    [editingMode, setThemeOverride],
  );

  const handleContrastChange = useCallback(
    (value: number) => {
      setThemeOverride(editingMode, "con", value);
    },
    [editingMode, setThemeOverride],
  );

  const handleReset = useCallback(() => {
    resetThemeOverrides(editingMode);
  }, [editingMode, resetThemeOverrides]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <Dialog.Content>
        <div className="flex items-center justify-between">
          <Dialog.Title>Theme</Dialog.Title>
          <ModeTabs value={editingMode} onChange={setEditingMode} />
        </div>

        <div className="mt-5 space-y-1">
          <ColorRow
            label="Background"
            value={getValue("bg")}
            onChange={handleColorChange("bg")}
          />
          <ColorRow
            label="Foreground"
            value={getValue("fg")}
            onChange={handleColorChange("fg")}
          />
          <ColorRow
            label="Accent"
            value={getValue("acc")}
            onChange={handleColorChange("acc")}
          />
          <ContrastRow
            value={overrides.con ?? defaults.con}
            onChange={handleContrastChange}
          />
        </div>

        <div className="mt-5 flex justify-end">
          <button
            type="button"
            onClick={handleReset}
            className="rounded-md px-3 py-1.5 text-xs font-medium text-ink-secondary transition-colors hover:bg-base-hover hover:text-ink-primary"
          >
            Reset to defaults
          </button>
        </div>
      </Dialog.Content>
    </Dialog>
  );
};
