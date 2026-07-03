"use client";

// Headless inline chip. Renders an unstyled <span> flow-surface with
// data-variant for styling hooks. Popups are not owned by this layer: a
// Chip.Preview child is captured and handed to `renderWithPreview` so the
// styled layer can compose its own hover-card/popover around the badge.

import {
  Children,
  type ComponentProps,
  isValidElement,
  type ReactElement,
  type ReactNode,
} from "react";
import type { ChipVariant } from "./chip-markdown";

type ChipPreviewProps = { children: ReactNode };

// Marker component — never renders directly. ChipRoot inspects its children
// and routes ChipPreview's content into `renderWithPreview`.
const ChipPreview = (_props: ChipPreviewProps): ReactNode => null;

export type ChipRootProps = {
  variant?: ChipVariant;
  /**
   * Called when a Chip.Preview child is present. Receives the rendered badge
   * element and the preview content; compose your popup of choice around
   * them. Without it, the preview content is ignored.
   */
  renderWithPreview?: (badge: ReactElement, preview: ReactNode) => ReactNode;
  className?: string;
  children?: ReactNode;
} & Omit<ComponentProps<"span">, "children" | "className">;

const ChipRoot = ({ variant, renderWithPreview, className, children, ...props }: ChipRootProps) => {
  const childArray = Children.toArray(children);
  const previewChild = childArray.find(
    (child) => isValidElement(child) && child.type === ChipPreview,
  ) as ReactElement<ChipPreviewProps> | undefined;
  const inlineChildren = childArray.filter(
    (child) => !isValidElement(child) || child.type !== ChipPreview,
  );

  const badge = (
    <span data-slot="chip" data-variant={variant} className={className} {...props}>
      {inlineChildren}
    </span>
  );

  if (!previewChild || !renderWithPreview) return badge;

  return renderWithPreview(badge, previewChild.props.children);
};

export type ChipIconProps = {
  className?: string;
  children: ReactNode;
};

const ChipIcon = ({ className, children }: ChipIconProps) => (
  <span aria-hidden data-slot="chip-icon" className={className}>
    {children}
  </span>
);

export type ChipLabelProps = {
  className?: string;
  children: ReactNode;
};

const ChipLabel = ({ className, children }: ChipLabelProps) => (
  <span data-slot="chip-label" className={className}>
    {children}
  </span>
);

export const Chip = Object.assign(ChipRoot, {
  Icon: ChipIcon,
  Label: ChipLabel,
  Preview: ChipPreview,
});
