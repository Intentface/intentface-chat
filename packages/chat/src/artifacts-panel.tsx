"use client";

// Headless artifacts side panel: open-gated structural parts with data
// attributes. Slide/fade motion, markdown rendering, and header/footer
// controls belong to the styled layer.

import type { ComponentProps } from "react";

export type ArtifactsPanelRootProps = ComponentProps<"aside"> & {
  open: boolean;
  /** Keep the panel mounted (hidden) when closed. */
  keepMounted?: boolean;
};

const ArtifactsPanelRoot = ({ open, keepMounted = false, ...props }: ArtifactsPanelRootProps) => {
  if (!open && !keepMounted) return null;

  return (
    <aside data-slot="artifacts-panel" data-open={open || undefined} hidden={!open} {...props} />
  );
};

export type ArtifactsPanelHeaderProps = ComponentProps<"div">;

const ArtifactsPanelHeader = (props: ArtifactsPanelHeaderProps) => (
  <div data-slot="artifacts-panel-header" {...props} />
);

export type ArtifactsPanelViewportProps = ComponentProps<"div">;

const ArtifactsPanelViewport = ({ style, ...props }: ArtifactsPanelViewportProps) => (
  <div data-slot="artifacts-panel-viewport" style={{ overflowY: "auto", ...style }} {...props} />
);

export type ArtifactsPanelFooterProps = ComponentProps<"div">;

const ArtifactsPanelFooter = (props: ArtifactsPanelFooterProps) => (
  <div data-slot="artifacts-panel-footer" {...props} />
);

export const ArtifactsPanel = Object.assign(ArtifactsPanelRoot, {
  Header: ArtifactsPanelHeader,
  Viewport: ArtifactsPanelViewport,
  Footer: ArtifactsPanelFooter,
});
