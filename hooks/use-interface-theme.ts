"use client";

import { useTheme } from "next-themes";
import { useCallback } from "react";
import {
  type CustomSeeds,
  findMatchingPreset,
  getDefaultSeeds,
  type PresetDefinition,
  type ThemeMode,
} from "@/lib/interface-theme";
import { useSettingsStore } from "@/lib/store/settings";

export type InterfaceThemeMode = "light" | "dark" | "system";

type UseInterfaceThemeResult = {
  mode: InterfaceThemeMode;
  resolvedMode: ThemeMode;
  setMode: (next: InterfaceThemeMode) => void;
  seeds: CustomSeeds;
  setSeed: <K extends keyof CustomSeeds>(key: K, value: CustomSeeds[K]) => void;
  preset: PresetDefinition | null;
  setPreset: (preset: PresetDefinition) => void;
  reset: () => void;
};

export const useInterfaceTheme = (): UseInterfaceThemeResult => {
  const { theme, resolvedTheme, setTheme } = useTheme();
  const themeOverrides = useSettingsStore((state) => state.themeOverrides);
  const setThemeOverride = useSettingsStore((state) => state.setThemeOverride);
  const setThemeOverrides = useSettingsStore((state) => state.setThemeOverrides);
  const resetThemeOverrides = useSettingsStore((state) => state.resetThemeOverrides);

  const mode = (theme ?? "system") as InterfaceThemeMode;
  const resolvedMode: ThemeMode = resolvedTheme === "dark" ? "dark" : "light";

  const defaults = getDefaultSeeds(resolvedMode);
  const overrides = themeOverrides[resolvedMode];
  const seeds: CustomSeeds = {
    bg: overrides.bg ?? defaults.bg,
    fg: overrides.fg ?? defaults.fg,
    acc: overrides.acc ?? defaults.acc,
    con: overrides.con ?? defaults.con,
  };

  const preset = findMatchingPreset(resolvedMode, seeds);

  const setMode = useCallback((next: InterfaceThemeMode) => setTheme(next), [setTheme]);

  const setSeed = useCallback(
    <K extends keyof CustomSeeds>(key: K, value: CustomSeeds[K]) => {
      setThemeOverride(resolvedMode, key, value);
    },
    [resolvedMode, setThemeOverride],
  );

  const setPreset = useCallback(
    (next: PresetDefinition) => {
      setThemeOverrides(resolvedMode, next.seeds);
    },
    [resolvedMode, setThemeOverrides],
  );

  const reset = useCallback(() => {
    resetThemeOverrides(resolvedMode);
  }, [resolvedMode, resetThemeOverrides]);

  return {
    mode,
    resolvedMode,
    setMode,
    seeds,
    setSeed,
    preset,
    setPreset,
    reset,
  };
};
