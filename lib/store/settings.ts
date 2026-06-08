import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { ThreadAutoScrollMode } from "@/components/ai/thread";

type ThemeOverrides = {
  bg?: string;
  fg?: string;
  acc?: string;
  con?: number;
};

type ThemeMode = "light" | "dark";

type SettingsStore = {
  themeOverrides: Record<ThemeMode, ThemeOverrides>;
  setThemeOverride: (mode: ThemeMode, key: keyof ThemeOverrides, value: string | number) => void;
  setThemeOverrides: (mode: ThemeMode, overrides: ThemeOverrides) => void;
  resetThemeOverrides: (mode: ThemeMode) => void;
  scrollMode: ThreadAutoScrollMode;
  setScrollMode: (mode: ThreadAutoScrollMode) => void;
};

export type { ThemeOverrides, ThemeMode };

export const useSettingsStore = create<SettingsStore>()(
  persist(
    (set) => ({
      themeOverrides: { light: {}, dark: {} },
      scrollMode: "follow",
      setScrollMode: (mode) => set({ scrollMode: mode }),
      setThemeOverride: (mode, key, value) =>
        set((state) => ({
          themeOverrides: {
            ...state.themeOverrides,
            [mode]: { ...state.themeOverrides[mode], [key]: value },
          },
        })),
      setThemeOverrides: (mode, overrides) =>
        set((state) => ({
          themeOverrides: { ...state.themeOverrides, [mode]: overrides },
        })),
      resetThemeOverrides: (mode) =>
        set((state) => ({
          themeOverrides: { ...state.themeOverrides, [mode]: {} },
        })),
    }),
    { name: "settings-store" },
  ),
);
