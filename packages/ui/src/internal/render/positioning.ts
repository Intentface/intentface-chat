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
// and `--anchor-available-height` / `--anchor-available-width` (free space in the placement
// direction — cap max-height + scroll instead of overflow) from the size middleware; and
// `data-side`/`data-align` for the transition origin. Base UI-style: the styling layer opts into
// the vars, the primitive imposes nothing.

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
  /**
   * Called with the resolved placement every time one lands — which is what flip and shift may
   * have changed it to, not necessarily what was asked for. Fires on every reposition, so a
   * caller holding it in state must compare before setting. Until the first call the surface has
   * no left/top, so a consumer that transitions those should withhold paint rather than animate
   * in from 0,0.
   */
  onPositioned?: (placement: { side: AnchorSide; align: AnchorAlign }) => void;
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
    onPositioned,
  }: UseAnchorPositioningOptions = {},
) => {
  useEffect(() => {
    const floating = floatingRef.current;
    if (!enabled || !floating) return;

    const placement = (align === "center" ? side : `${side}-${align}`) as Placement;

    // Out of flow *before* anything is measured. A static element portaled into a flex or
    // grid container is a layout participant, and a 500px participant shoves its siblings —
    // including the anchor — somewhere else for exactly the measurement that matters.
    floating.style.position = "absolute";

    // Withhold paint until the first placement lands, since until then the surface has no
    // left/top and would otherwise show at 0,0 for a frame — and a consumer transitioning
    // left/top would animate it in from the corner (`auto` → a length is not interpolable).
    // `data-side` is written below and by nothing else, so its absence means "never placed".
    if (!floating.hasAttribute("data-side")) {
      floating.style.visibility = "hidden";
    }

    // Virtual reference: re-reads the anchor rect each run, so a re-created anchor (e.g. the
    // command badge decoration re-rendering as you type) is tracked without re-subscribing.
    const reference: VirtualElement = {
      getBoundingClientRect: () => getAnchor()?.getBoundingClientRect() ?? EMPTY_RECT,
      get contextElement() {
        return getAnchor() ?? undefined;
      },
    };

    const update = () => {
      // The first placement must land, not animate: a consumer transitioning
      // left/top would otherwise slide the surface in from wherever the browser
      // had it before there were coordinates at all.
      const firstPlacement = !floating.hasAttribute("data-side");

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
            apply({ availableWidth, availableHeight, rects }) {
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
              floating.style.setProperty(
                "--anchor-available-width",
                `${Math.max(0, Math.round(availableWidth))}px`,
              );
            },
          }),
        ],
      }).then(({ x, y, placement: resolved }) => {
        if (firstPlacement) floating.style.transition = "none";
        floating.style.position = "absolute";
        floating.style.left = `${Math.round(x)}px`;
        floating.style.top = `${Math.round(y)}px`;
        // Placed, so it may paint. Cleared rather than set to "visible", which would override
        // a consumer hiding it for its own reasons.
        floating.style.visibility = "";
        const [resolvedSide = side, resolvedAlign = "center"] = resolved.split("-");
        floating.setAttribute("data-side", resolvedSide);
        floating.setAttribute("data-align", resolvedAlign);
        onPositioned?.({
          side: resolvedSide as AnchorSide,
          align: resolvedAlign as AnchorAlign,
        });
        // Flush the first coordinates into computed style while transitions are off, then
        // hand the property back. A deferred restore (rAF) is not enough: rAF callbacks run
        // *before* the frame's style recalc, so the recalc would still see `auto → x` with
        // the consumer's transition live and animate it in from the static position.
        if (firstPlacement) {
          void floating.offsetHeight;
          floating.style.transition = "";
        }
      });
    };

    return autoUpdate(reference, floating, update);
  }, [enabled, getAnchor, floatingRef, side, align, sideOffset, collisionPadding, pin, onPositioned]);
};
