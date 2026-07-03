"use client";

// Headless inline artifact card: a toggle button that disables itself while
// the artifact is still streaming in. Icon, label copy, and entrance motion
// belong to the styled layer.

import type { ComponentProps } from "react";

export type ArtifactCardProps = ComponentProps<"button"> & {
  state: string;
  onToggle: () => void;
};

export const isArtifactStreaming = (state: string) => state === "input-streaming";

export const ArtifactCard = ({ state, onToggle, ...props }: ArtifactCardProps) => (
  <button
    type="button"
    data-slot="artifact-card"
    data-streaming={isArtifactStreaming(state) || undefined}
    onClick={onToggle}
    disabled={isArtifactStreaming(state)}
    {...props}
  />
);
