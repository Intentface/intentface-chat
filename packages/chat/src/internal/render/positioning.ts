"use client";

// Collision-aware anchor positioning via @floating-ui/dom, shared by Composer.Popover
// (anchored to the active command badge) and a positioned Composer.Panel (anchored to the
// composer container). Positions the floating element with flip/shift/size and keeps it there
// across scroll/resize/anchor movement (autoUpdate); `pin` opts out of flip/shift.
//
// Everything is written imperatively — no per-render React state — so a flip or a scroll never
// re-renders the tree: `position: absolute` + left/top (page coordinates, so the surface scrolls
// natively with the page instead of chasing the anchor a frame behind it); `--anchor-width` /
// `--anchor-height` (the anchor's own size, e.g. so a panel can be `width: var(--anchor-width)`)
// and `--anchor-available-height` (free space in the placement direction — cap max-height + scroll
// instead of overflow) from the size middleware; and `data-side`/`data-align` for the transition
// origin. Base UI-style: the styling layer opts into the vars, the primitive imposes nothing.

import {
  autoUpdate,
  computePosition,
  flip,
  offset,
  type Placement,
  shift,
  size,
  type VirtualElement,
} from "@floating-ui/dom";
import { type RefObject, useEffect } from "react";

export type AnchorSide = "top" | "bottom" | "left" | "right";
export type AnchorAlign = "start" | "center" | "end";

export type UseAnchorPositioningOptions = {
  /** Position only while true (e.g. while the surface is mounted/open). */
  enabled?: boolean;
  /** Preferred side; flips to the opposite when there's no room. Default "top". */
  side?: AnchorSide;
  /** Alignment along the side. Default "center". */
  align?: AnchorAlign;
  /** Gap between anchor and floating element. Default 0. */
  sideOffset?: number;
  /** Keep this many px from the collision boundary. Default 8. */
  collisionPadding?: number;
  /**
   * Pin to `side`/`align` without collision repositioning — drops flip + shift, so the surface
   * stays put and may run off-screen when there's no room. `size` still publishes its vars.
   * Default false.
   */
  pin?: boolean;
};

const EMPTY_RECT: DOMRect = {
  x: 0,
  y: 0,
  width: 0,
  height: 0,
  top: 0,
  right: 0,
  bottom: 0,
  left: 0,
  toJSON: () => "",
};

export const useAnchorPositioning = (
  getAnchor: () => Element | null,
  floatingRef: RefObject<HTMLElement | null>,
  {
    enabled = true,
    side = "top",
    align = "center",
    sideOffset = 0,
    collisionPadding = 8,
    pin = false,
  }: UseAnchorPositioningOptions = {},
) => {
  useEffect(() => {
    const floating = floatingRef.current;
    if (!enabled || !floating) return;

    const placement = (align === "center" ? side : `${side}-${align}`) as Placement;

    // Virtual reference: re-reads the anchor rect each run, so a re-created anchor (e.g. the
    // command badge decoration re-rendering as you type) is tracked without re-subscribing.
    const reference: VirtualElement = {
      getBoundingClientRect: () => getAnchor()?.getBoundingClientRect() ?? EMPTY_RECT,
      get contextElement() {
        return getAnchor() ?? undefined;
      },
    };

    const update = () => {
      computePosition(reference, floating, {
        // Absolute (page-coordinate), not fixed: portaled to the body, the surface then
        // scrolls *with* the page natively — so following the anchor on scroll needs no
        // per-frame JS write and can't lag a frame behind it (the "wobble"). autoUpdate
        // still re-runs for real layout changes (flip/shift/resize/anchor movement).
        strategy: "absolute",
        placement,
        middleware: [
          offset(sideOffset),
          // Collision repositioning — skipped when pinned, so the surface holds `side`/`align`.
          ...(pin
            ? []
            : [flip({ padding: collisionPadding }), shift({ padding: collisionPadding })]),
          size({
            padding: collisionPadding,
            apply({ availableHeight, rects }) {
              // Anchor's own size + the free space toward the placement side, published as
              // vars for the styling layer to consume (e.g. `width: var(--anchor-width)`,
              // `max-height: var(--anchor-available-height)`). Never sets width/height itself.
              floating.style.setProperty(
                "--anchor-width",
                `${Math.round(rects.reference.width)}px`,
              );
              floating.style.setProperty(
                "--anchor-height",
                `${Math.round(rects.reference.height)}px`,
              );
              floating.style.setProperty(
                "--anchor-available-height",
                `${Math.max(0, Math.round(availableHeight))}px`,
              );
            },
          }),
        ],
      }).then(({ x, y, placement: resolved }) => {
        floating.style.position = "absolute";
        floating.style.left = `${Math.round(x)}px`;
        floating.style.top = `${Math.round(y)}px`;
        const [resolvedSide = side, resolvedAlign = "center"] = resolved.split("-");
        floating.setAttribute("data-side", resolvedSide);
        floating.setAttribute("data-align", resolvedAlign);
      });
    };

    return autoUpdate(reference, floating, update);
  }, [enabled, getAnchor, floatingRef, side, align, sideOffset, collisionPadding, pin]);
};
