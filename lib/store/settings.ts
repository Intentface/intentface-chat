import { create } from "zustand";
import { persist } from "zustand/middleware";

type SettingsStore = {
  showBalsam: boolean;
  setShowBalsam: (show: boolean) => void;
};

export const useSettingsStore = create<SettingsStore>()(
  persist(
    (set) => ({
      showBalsam: false,
      setShowBalsam: (show) => set({ showBalsam: show }),
    }),
    { name: "settings-store" },
  ),
);
