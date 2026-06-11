"use client";

import { cva, type VariantProps } from "class-variance-authority";
import {
  Children,
  type ComponentProps,
  isValidElement,
  type ReactElement,
  type ReactNode,
} from "react";
import HoverCard from "@/components/ui/hover-card";
import { cn } from "@/lib/utils";

// Shared inline text-flow surface for committed chips and the composer's
// active-prefix decoration — one model so both sit on the same baseline/line box.
// `inline` (not inline-flex) so the chip flows as text; `py` is visual only and
// doesn't grow the line box; `box-decoration-clone` keeps padding/bg intact if a
// chip wraps; `leading-[inherit]` so it never inflates the editor's line height.
export const CHIP_SURFACE_CLASS =
  "box-decoration-clone inline rounded-sm px-0.75 py-0.5 align-baseline font-[450] leading-[inherit] whitespace-nowrap";

const chipVariants = cva(CHIP_SURFACE_CLASS, {
  variants: {
    variant: {
      primary: "bg-primary-hover text-ink-primary",
      accent: "bg-accent text-accent-ink",
      warning: "bg-warning text-warning-ink",
    },
  },
  defaultVariants: {
    variant: "primary",
  },
});

export type ChipVariant = NonNullable<VariantProps<typeof chipVariants>["variant"]>;

// Inline-block icon with a baseline nudge (not flex/absolute) so it rides the
// text baseline without inflating the line box. The -0.2em nudge is a starting
// point — tune against the editor's line-height.
const CHIP_ICON_WRAPPER_CLASSES =
  "mr-0.5 inline-block size-4 align-[-0.2em] text-ink-tertiary [&>svg]:block [&>svg]:size-4";

type ChipPreviewProps = { children: ReactNode };

// Marker component — never renders directly. ChipRoot inspects its children
// and routes ChipPreview's content into the HoverCard popup.
const ChipPreview = (_props: ChipPreviewProps): ReactNode => null;

type ChipRootProps = {
  variant?: ChipVariant;
  className?: string;
  children?: ReactNode;
} & Omit<ComponentProps<"span">, "children" | "className">;

const ChipRoot = ({ variant, className, children, ...props }: ChipRootProps) => {
  const childArray = Children.toArray(children);
  const previewChild = childArray.find(
    (child) => isValidElement(child) && child.type === ChipPreview,
  ) as ReactElement<ChipPreviewProps> | undefined;
  const inlineChildren = childArray.filter(
    (child) => !isValidElement(child) || child.type !== ChipPreview,
  );

  const badge = (
    <span data-slot="chip" className={cn(chipVariants({ variant }), className)} {...props}>
      {inlineChildren}
    </span>
  );

  if (!previewChild) return badge;

  return (
    <HoverCard>
      <HoverCard.Trigger render={badge} />
      <HoverCard.Content>{previewChild.props.children}</HoverCard.Content>
    </HoverCard>
  );
};

type ChipIconProps = {
  className?: string;
  children: ReactNode;
};

const ChipIcon = ({ className, children }: ChipIconProps) => (
  <span aria-hidden className={cn(CHIP_ICON_WRAPPER_CLASSES, className)}>
    {children}
  </span>
);

type ChipLabelProps = {
  className?: string;
  children: ReactNode;
};

const ChipLabel = ({ className, children }: ChipLabelProps) => (
  <span className={className}>{children}</span>
);

export const Chip = Object.assign(ChipRoot, {
  Icon: ChipIcon,
  Label: ChipLabel,
  Preview: ChipPreview,
});
