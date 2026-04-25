import { create } from "zustand";
import { persist } from "zustand/middleware";

type ThemeOverrides = {
  bg?: string;
  fg?: string;
  acc?: string;
  con?: number;
};

type ThemeMode = "light" | "dark";

type SettingsStore = {
  themeOverrides: Record<ThemeMode, ThemeOverrides>;
  setThemeOverride: (
    mode: ThemeMode,
    key: keyof ThemeOverrides,
    value: string | number,
  ) => void;
  resetThemeOverrides: (mode: ThemeMode) => void;
};

export type { ThemeOverrides, ThemeMode };

export const useSettingsStore = create<SettingsStore>()(
  persist(
    (set) => ({
      themeOverrides: { light: {}, dark: {} },
      setThemeOverride: (mode, key, value) =>
        set((state) => ({
          themeOverrides: {
            ...state.themeOverrides,
            [mode]: { ...state.themeOverrides[mode], [key]: value },
          },
        })),
      resetThemeOverrides: (mode) =>
        set((state) => ({
          themeOverrides: { ...state.themeOverrides, [mode]: {} },
        })),
    }),
    { name: "settings-store" },
  ),
);
