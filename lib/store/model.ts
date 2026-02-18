import { create } from "zustand";
import { DEFAULT_MODEL, type GeminiModelId } from "../models";

type ModelStore = {
  model: GeminiModelId;
  setModel: (model: GeminiModelId) => void;
};

export const useModelStore = create<ModelStore>((set) => ({
  model: DEFAULT_MODEL,
  setModel: (model) => set({ model }),
}));
