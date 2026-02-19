import { create } from "zustand";
import { DEFAULT_MODEL, type ModelId } from "../models";

type ModelStore = {
  model: ModelId;
  setModel: (model: ModelId) => void;
};

export const useModelStore = create<ModelStore>((set) => ({
  model: DEFAULT_MODEL,
  setModel: (model) => set({ model }),
}));
