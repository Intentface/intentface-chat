"use client";

// Composer.Panel — renders whichever PanelItem matches the active panel: the
// command-list override while a prefix is active, otherwise the consumer's
// `value`. It mirrors the open panel into the store so siblings (the context
// window) can yield. The open/close transition is presentation — the panel
// renders the matched child and exposes data-open/data-closed, and the styled
// layer composes its motion through the standard `render` prop.
//
// KNOWN INTERIM: the store mirror below is a controlled-prop→store sync via
// effect. The panel value is really derived (command-list override ⊕ the
// consumer's `value`), so it ought to be resolved on read rather than mirrored
// into a store slice — that refactor is deferred; kept as-is for now.

import { Children, Fragment, isValidElement, type ReactNode, useEffect } from "react";
import type { PrimitiveProps } from "../internal/primitive-props";
import { useRenderElement } from "../internal/render/useRenderElement";
import { openStateMapping } from "../internal/state-mappings";
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
};

export const ComposerPanel = ({
  children,
  value,
  className,
  render,
  style,
  ...elementProps
}: ComposerPanelProps) => {
  const store = useComposerContextStore();
  const isCommandListOpen = useComposer((composer) => composer.commands.isOpen);

  // When a command-list prefix is active, route the panel to its command-list
  // item regardless of what the consumer passed.
  const effectiveValue = isCommandListOpen ? COMMAND_LIST_PANEL_VALUE : value;

  const matchedChild = effectiveValue
    ? Children.toArray(children).find(
        (child) =>
          isValidElement(child) && (child.props as { value?: string }).value === effectiveValue,
      )
    : null;
  const hasMatch = matchedChild != null;

  // See KNOWN INTERIM note above.
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
          // The styled layer reads the matched child off props.children through
          // the standard render seam; null when nothing matches.
          children: hasMatch ? matchedChild : null,
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
