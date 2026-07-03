"use client";

// Headless text shimmer. Owns the spread math and exposes it as CSS variables
// (--shimmer-spread, --shimmer-duration) on a data-slot="shimmer" element; the
// styled layer supplies the gradient and a background-position keyframe
// animation driven by those variables.

import { type CSSProperties, type ElementType, memo, useMemo } from "react";

export type ShimmerProps = {
  children: string;
  as?: ElementType;
  className?: string;
  /** Animation duration in seconds, exposed as --shimmer-duration. */
  duration?: number;
  /** Highlight width per character, exposed as --shimmer-spread in px. */
  spread?: number;
  style?: CSSProperties;
};

const ShimmerComponent = ({
  children,
  as: Component = "p",
  className,
  duration = 2,
  spread = 2,
  style,
}: ShimmerProps) => {
  const dynamicSpread = useMemo(() => (children?.length ?? 0) * spread, [children, spread]);

  return (
    <Component
      data-slot="shimmer"
      className={className}
      style={
        {
          "--shimmer-spread": `${dynamicSpread}px`,
          "--shimmer-duration": `${duration}s`,
          ...style,
        } as CSSProperties
      }
    >
      {children}
    </Component>
  );
};

export const Shimmer = memo(ShimmerComponent);
