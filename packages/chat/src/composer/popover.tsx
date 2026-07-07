"use client";

// Composer.Popover — the floating alternative to Composer.Panel for command
// lists. Where Panel renders in-flow (growing the composer), Popover lifts the
// same CommandList children into a portal above the field, so it overlays
// instead of pushing layout. Mount one or the other with the same children —
// composition, not a variant flag.

import { useCallback, useRef } from "react";
import { createPortal } from "react-dom";
import type { PrimitiveProps } from "../internal/primitive-props";
import { useRenderElement } from "../internal/render/useRenderElement";
import { openStateMapping } from "../internal/state-mappings";
import { useIsomorphicLayoutEffect } from "./internals";
import { useComposer, useComposerContextStore } from "./store";

export type ComposerPopoverState = {
  open: boolean;
};

export type ComposerPopoverProps = PrimitiveProps<"div", ComposerPopoverState>;

export const ComposerPopover = ({
  children,
  className,
  render,
  style,
  ...elementProps
}: ComposerPopoverProps) => {
  const store = useComposerContextStore();
  const isOpen = useComposer((composer) => composer.commands.isOpen);
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
    if (!isOpen) return;
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
  }, [isOpen, reposition]);

  const element = useRenderElement(
    "div",
    { className, render, style },
    {
      ref: elementRef,
      state: { open: isOpen },
      stateAttributesMapping: openStateMapping,
      props: [
        {
          "data-slot": "composer-popover",
          // Positioning essentials; left/bottom are set imperatively above.
          style: { position: "fixed" },
          // Keep the editor focused when clicking the popover chrome so it
          // doesn't blur-dismiss; command items run their own selection on
          // mousedown. The list never takes focus.
          onMouseDown: (event) => event.preventDefault(),
          children,
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
