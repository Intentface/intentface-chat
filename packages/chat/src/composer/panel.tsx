"use client";

// Composer.Panel — owns which panel content is active: the command-list
// override, the matched Composer.PanelItem child, and the store mirror that
// lets siblings (the context window) yield while a panel is open. The open/
// close transition is presentation: the styled layer supplies renderContent
// and composes its own motion around the matched child.

import {
  Children,
  Fragment,
  isValidElement,
  type ReactNode,
  useCallback,
  useEffect,
  useRef,
} from "react";
import { createPortal } from "react-dom";
import type { PrimitiveProps } from "../internal/primitive-props";
import { useRenderElement } from "../internal/render/useRenderElement";
import { openStateMapping } from "../internal/state-mappings";
import { useIsomorphicLayoutEffect } from "./internals";
import { useComposer, useComposerContextStore } from "./store";

/**
 * Reserved `Composer.PanelItem` value the panel routes to while a command-list
 * prefix is active. Give your command-list panel item this value.
 */
export const COMMAND_LIST_PANEL_VALUE = "command-list";

export type ComposerPanelState = {
  open: boolean;
};

export type ComposerPanelProps = Omit<PrimitiveProps<"div", ComposerPanelState>, "children"> & {
  value?: string;
  children?: ReactNode;
  /**
   * Presentation inversion: receives the matched panel child (or null) and
   * whether a match exists; compose your open/close transition around it.
   * Without it, the matched child renders directly.
   */
  renderContent?: (matchedChild: ReactNode, hasMatch: boolean) => ReactNode;
};

export const ComposerPanel = ({
  children,
  value,
  renderContent,
  className,
  render,
  style,
  ...elementProps
}: ComposerPanelProps) => {
  const store = useComposerContextStore();
  const isCommandListOpen = useComposer((composer) => composer.commands.isOpen);

  // When a command-list prefix is active, route the panel to its
  // command-list item regardless of what the consumer passed.
  const effectiveValue = isCommandListOpen ? COMMAND_LIST_PANEL_VALUE : value;

  const matchedChild = effectiveValue
    ? Children.toArray(children).find(
        (child) =>
          isValidElement(child) && (child.props as { value?: string }).value === effectiveValue,
      )
    : null;
  const hasMatch = matchedChild != null;

  // Mirror the open panel into the store so sibling parts (the context
  // window) can yield while a panel is open and consumers can read which
  // panel is active.
  useEffect(() => {
    store.setPanelValue(hasMatch ? (effectiveValue ?? null) : null);
    return () => store.setPanelValue(null);
  }, [store, hasMatch, effectiveValue]);

  return useRenderElement(
    "div",
    { className, render, style },
    {
      state: { open: hasMatch },
      stateAttributesMapping: openStateMapping,
      props: [
        {
          "data-slot": "composer-panel",
          children: renderContent
            ? renderContent(matchedChild ?? null, hasMatch)
            : hasMatch
              ? matchedChild
              : null,
        },
        elementProps,
      ],
    },
  );
};

export type ComposerPanelItemProps = PrimitiveProps<"div"> & {
  value: string;
};

export const ComposerPanelItem = ({
  value,
  className,
  render,
  style,
  ...elementProps
}: ComposerPanelItemProps) => {
  const element = useRenderElement(
    "div",
    { className, render, style },
    { props: [{ "data-slot": "composer-panel-item" }, elementProps] },
  );

  // Keyed per value so switching panels remounts the item's subtree.
  return <Fragment key={value}>{element}</Fragment>;
};

// ---------------------------------------------------------------------------
// Composer.Popover — the floating alternative to Composer.Panel for command
// lists. Where Panel renders in-flow (growing the composer), Popover lifts the
// same CommandList children into a portal above the field, so it overlays
// instead of pushing layout. Mount one or the other with the same children —
// composition, not a variant flag.
// ---------------------------------------------------------------------------

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
