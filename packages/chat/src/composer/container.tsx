"use client";

// Composer.Container — the visual dock chrome. Clicking anywhere on the
// chrome (not the editor or interactive controls) focuses the editor without
// cancelling in-editor text selection.

import type { PrimitiveProps } from "../internal/primitive-props";
import { useRenderElement } from "../internal/render/useRenderElement";
import { useComposerContextStore } from "./store";

export type ComposerContainerProps = PrimitiveProps<"div">;

export const ComposerContainer = ({
  className,
  render,
  style,
  ...elementProps
}: ComposerContainerProps) => {
  const store = useComposerContextStore();

  const handleMouseDown = (event: React.MouseEvent<HTMLDivElement>) => {
    const target = event.target as HTMLElement;
    // The editor and interactive controls own their mouse behavior. Calling
    // preventDefault on a mousedown inside the editable area would cancel the
    // browser's text-selection drag, so only hijack focus when the click lands
    // on the surrounding chrome.
    if (target.closest("button, a, input, [data-composer-editor]")) {
      return;
    }

    event.preventDefault();
    store.controller.ensureFocus();
  };

  return useRenderElement(
    "div",
    { className, render, style },
    {
      // Register the element so Composer.Popover can observe it for repositioning.
      ref: store.containerRef,
      props: [
        {
          role: "button",
          tabIndex: 0,
          "data-composer-container": "",
          onMouseDown: handleMouseDown,
        },
        elementProps,
      ],
    },
  );
};
