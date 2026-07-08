"use client";

// Composer.Panel — the in-flow surface region. `children` is either normal nodes
// or a callback receiving the whole composer state, so you can pick what to show
// by priority: `{(c) => c.commands.active ? <CommandList/> : c.askUser.active ?
// <AskUser/> : null}`. Gate with the callback when you need a native's store
// state; pass plain children gated with your own state otherwise.
//
// The host element always renders; visibility is exposed as `open` (whether the
// resolved content is non-empty) via the render's second arg and data-open/
// data-closed — the same seam as Composer.Popover. That lets the styled layer
// mount the card under an AnimatePresence and get a real open/close transition.

import { Children, type ReactNode } from "react";
import type { PrimitiveProps } from "../internal/primitive-props";
import { useRenderElement } from "../internal/render/useRenderElement";
import { openStateMapping } from "../internal/state-mappings";
import { type ComposerState, useComposer } from "./store";

export type ComposerPanelState = {
  open: boolean;
};

export type ComposerPanelChildren = ReactNode | ((composer: ComposerState) => ReactNode);

export type ComposerPanelProps = Omit<PrimitiveProps<"div", ComposerPanelState>, "children"> & {
  children?: ComposerPanelChildren;
};

export const ComposerPanel = ({
  className,
  render,
  style,
  children,
  ...elementProps
}: ComposerPanelProps) => {
  const composer = useComposer((c) => c);
  const content = typeof children === "function" ? children(composer) : children;
  const open = Children.toArray(content).length > 0;

  return useRenderElement(
    "div",
    { className, render, style },
    {
      state: { open },
      stateAttributesMapping: openStateMapping,
      props: [{ "data-slot": "composer-panel", children: content }, elementProps],
    },
  );
};
