"use client";

// Composer.Popover — the floating alternative to a Composer.Panel for the
// command list. Where a Panel renders in-flow (growing the composer), Popover
// lifts the same CommandList children into a portal above the field, so it
// overlays instead of pushing layout. Like Panel, it's content-driven: the
// consumer gates its children on `commands.active`, so an empty popover (all
// gated out) stays closed. Popover anchors to the active command badge by
// setting left/bottom, but leaves the positioning context (position:
// fixed/absolute) to the consumer's styling — like Base UI's Positioner
// `positionMethod`. It exposes data-open/data-closed for animation.

import { Children, type ReactNode, useCallback, useRef } from "react";
import { createPortal } from "react-dom";
import type { PrimitiveProps } from "../internal/primitive-props";
import { useRenderElement } from "../internal/render/useRenderElement";
import { openStateMapping } from "../internal/state-mappings";
import { useIsomorphicLayoutEffect } from "./internals";
import { type ComposerState, useComposer, useComposerContextStore } from "./store";

export type ComposerPopoverState = {
  open: boolean;
};

export type ComposerPopoverProps = Omit<PrimitiveProps<"div", ComposerPopoverState>, "children"> & {
  children?: ReactNode | ((composer: ComposerState) => ReactNode);
};

export const ComposerPopover = ({
  children,
  className,
  render,
  style,
  ...elementProps
}: ComposerPopoverProps) => {
  const store = useComposerContextStore();
  const composer = useComposer((c) => c);
  // `children` may be a callback receiving composer state (to gate on a native's
  // active flag) or plain nodes. Open while the resolved content is non-empty —
  // React can't read a child's rendered null off the prop, so count is the test.
  const content = typeof children === "function" ? children(composer) : children;
  const open = Children.toArray(content).length > 0;
  const elementRef = useRef<HTMLDivElement | null>(null);

  // Pin the popover just above the active command badge (the trigger token in
  // the editor), left-aligned to it and opening upward. Deterministic, so no
  // floating library: read the badge's rect and set left + bottom directly.
  const reposition = useCallback(() => {
    const element = elementRef.current;
    const editor = store.editorRef.current;
    if (!element || !editor) return;
    const badge = editor.view.dom.querySelector("[data-command-badge]");
    if (!badge) return;
    // A wrapped token spans several line boxes; the first is where the prefix
    // sits, so anchor to it.
    const rect = badge.getClientRects()[0] ?? badge.getBoundingClientRect();
    element.style.left = `${rect.left}px`;
    element.style.bottom = `${window.innerHeight - rect.top}px`;
  }, [store]);

  useIsomorphicLayoutEffect(() => {
    if (!open) return;
    // Runs before paint, so the first frame is already positioned — no flash.
    reposition();

    // The badge shifts when the container's box changes (attachments strip,
    // multi-line growth) or the viewport scrolls/resizes. Scroll is captured so
    // the editor's own overflow scroll counts too.
    const observer = new ResizeObserver(reposition);
    if (store.containerRef.current) observer.observe(store.containerRef.current);
    window.addEventListener("scroll", reposition, true);
    window.addEventListener("resize", reposition);
    return () => {
      observer.disconnect();
      window.removeEventListener("scroll", reposition, true);
      window.removeEventListener("resize", reposition);
    };
  }, [open, reposition]);

  const element = useRenderElement(
    "div",
    { className, render, style },
    {
      ref: elementRef,
      state: { open },
      stateAttributesMapping: openStateMapping,
      props: [
        {
          "data-slot": "composer-popover",
          // left/bottom are set imperatively above; the consumer supplies the
          // positioning context (e.g. `position: fixed`) via className/style, so
          // the primitive imposes no positioning of its own.
          // Keep the editor focused when clicking the popover chrome so it
          // doesn't blur-dismiss; command items run their own selection on
          // mousedown. The list never takes focus.
          onMouseDown: (event) => event.preventDefault(),
          children: content,
        },
        elementProps,
      ],
    },
  );

  // Stays mounted (positioning only runs while open, so a closed popover just
  // holds its last position). Open/closed is exposed as data-open/data-closed
  // for the styled layer to animate against — same as the other parts.
  if (typeof document === "undefined") return null;
  return createPortal(element, document.body);
};
