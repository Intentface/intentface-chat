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

const chipVariants = cva(
  "inline-flex items-center gap-0.5 h-6 rounded-sm px-0.75 font-[450] leading-[normal] align-[-1px] [text-box:trim-both_cap_alphabetic]",
  {
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
  },
);

export type ChipVariant = NonNullable<VariantProps<typeof chipVariants>["variant"]>;

const CHIP_ICON_WRAPPER_CLASSES =
  "relative w-4 h-[1em] text-ink-tertiary [&>svg]:absolute [&>svg]:top-1/2 [&>svg]:left-0 [&>svg]:size-4 [&>svg]:-translate-y-1/2";

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
