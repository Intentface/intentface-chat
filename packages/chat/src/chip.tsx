"use client";

// Headless inline chip. Renders an unstyled <span> flow-surface with
// data-variant for styling hooks. Popups are not owned by this layer: a
// Chip.Preview child is captured and handed to `renderWithPreview` so the
// styled layer can compose its own hover-card/popover around the badge.
// Every part supports the Base UI render prop.

import { Children, isValidElement, type ReactElement, type ReactNode } from "react";
import type { PrimitiveProps } from "./internal/primitive-props";
import { useRenderElement } from "./internal/render/useRenderElement";

type ChipPreviewProps = { children: ReactNode };

// Marker component — never renders directly. ChipRoot inspects its children
// and routes ChipPreview's content into `renderWithPreview`.
const ChipPreview = (_props: ChipPreviewProps): ReactNode => null;

export type ChipState = {
  /** Opaque styling hook, surfaced as data-variant. */
  variant: string | undefined;
};

export type ChipRootProps = PrimitiveProps<"span", ChipState> & {
  variant?: string;
  /**
   * Called when a Chip.Preview child is present. Receives the rendered badge
   * element and the preview content; compose your popup of choice around
   * them. Without it, the preview content is ignored.
   */
  renderWithPreview?: (badge: ReactElement, preview: ReactNode) => ReactNode;
};

const ChipRoot = ({
  variant,
  renderWithPreview,
  className,
  render,
  style,
  children,
  ...elementProps
}: ChipRootProps) => {
  const childArray = Children.toArray(children);
  const previewChild = childArray.find(
    (child) => isValidElement(child) && child.type === ChipPreview,
  ) as ReactElement<ChipPreviewProps> | undefined;
  const inlineChildren = childArray.filter(
    (child) => !isValidElement(child) || child.type !== ChipPreview,
  );

  const badge = useRenderElement(
    "span",
    { className, render, style },
    {
      state: { variant },
      props: [{ "data-slot": "chip", children: inlineChildren }, elementProps],
    },
  );

  if (!previewChild || !renderWithPreview) return badge;

  return renderWithPreview(badge, previewChild.props.children);
};

export type ChipIconProps = PrimitiveProps<"span">;

const ChipIcon = ({ className, render, style, ...elementProps }: ChipIconProps) =>
  useRenderElement(
    "span",
    { className, render, style },
    { props: [{ "aria-hidden": true, "data-slot": "chip-icon" }, elementProps] },
  );

export type ChipLabelProps = PrimitiveProps<"span">;

const ChipLabel = ({ className, render, style, ...elementProps }: ChipLabelProps) =>
  useRenderElement(
    "span",
    { className, render, style },
    { props: [{ "data-slot": "chip-label" }, elementProps] },
  );

export const Chip = Object.assign(ChipRoot, {
  Icon: ChipIcon,
  Label: ChipLabel,
  Preview: ChipPreview,
});
