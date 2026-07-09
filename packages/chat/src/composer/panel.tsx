"use client";

// Composer.Panel — the in-flow surface region. `children` is either normal nodes
// or a callback receiving the whole composer state, so you can pick what to show
// by priority: `{(c) => c.commands.active ? <CommandList/> : c.askUser.active ?
// <AskUser/> : null}`.
//
// Base UI-style open/close lifecycle. `open` tracks whether the resolved content is
// non-empty (flips false the instant the source closes). The host stays mounted through
// its close animation — while closing it keeps rendering the *last* non-empty content and
// exposes data-ending-style — and unmounts only once animations finish (useOpenChangeComplete
// → store.finalizePanelClose, which clears the native slices' sticky `present` so the frozen
// content can drop). Seam: data-open / data-closed / data-starting-style / data-ending-style
// (+ `transitionStatus`) — animate with CSS or Motion, same as Composer.Popover.

import { Children, type ReactNode, useRef } from "react";
import type { PrimitiveProps } from "../internal/primitive-props";
import {
  type TransitionStatus,
  useOpenChangeComplete,
  useTransitionStatus,
} from "../internal/render/transition";
import { useRenderElement } from "../internal/render/useRenderElement";
import { openStateMapping, transitionStatusMapping } from "../internal/state-mappings";
import { type ComposerState, useComposer, useComposerContextStore } from "./store";

export type ComposerPanelState = {
  open: boolean;
  transitionStatus: TransitionStatus;
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
  const store = useComposerContextStore();
  const composer = useComposer((c) => c);
  const content = typeof children === "function" ? children(composer) : children;
  // Logical open — from the raw, source-gated content, so it goes false immediately on close.
  const open = Children.toArray(content).length > 0;

  const ref = useRef<HTMLDivElement>(null);
  const { mounted, setMounted, transitionStatus } = useTransitionStatus(open);

  // Freeze the last non-empty content so the panel keeps rendering it while it animates
  // closed. React reconciles by type+position, so the content fiber (e.g. the command list)
  // isn't remounted — and it survives store-driven nulling because the native slices' sticky
  // `present` flag keeps its own gate open until finalizePanelClose() below.
  const lastContentRef = useRef(content);
  if (open) lastContentRef.current = content;
  const rendered = open ? content : lastContentRef.current;

  // Once the close animation finishes: unmount, and clear `present` so the frozen content drops.
  useOpenChangeComplete({
    open,
    ref,
    enabled: !open && mounted,
    onComplete: () => {
      setMounted(false);
      store.finalizePanelClose();
    },
  });

  return useRenderElement(
    "div",
    { className, render, style },
    {
      enabled: mounted,
      state: { open, transitionStatus },
      stateAttributesMapping: { ...openStateMapping, ...transitionStatusMapping },
      ref,
      props: [{ "data-slot": "composer-panel", children: rendered }, elementProps],
    },
  );
};
