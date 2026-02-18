import { create } from "zustand";

export type Artifact = {
  id: string;
  title: string;
  content: string;
};

type ArtifactStore = {
  activeArtifact: Artifact | null;
  isOpen: boolean;
  openArtifact: (artifact: Artifact) => void;
  toggleArtifact: (artifact: Artifact) => void;
  closePanel: () => void;
};

export const useArtifactStore = create<ArtifactStore>((set, get) => ({
  activeArtifact: null,
  isOpen: false,
  openArtifact: (artifact) => set({ activeArtifact: artifact, isOpen: true }),
  toggleArtifact: (artifact) => {
    const { activeArtifact, isOpen } = get();
    if (isOpen && activeArtifact?.id === artifact.id) {
      set({ isOpen: false });
    } else {
      set({ activeArtifact: artifact, isOpen: true });
    }
  },
  closePanel: () => set({ isOpen: false }),
}));
