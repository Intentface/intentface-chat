"use client";

// Composer.Container — the visual dock chrome. Clicking anywhere on the
// chrome (not the editor or interactive controls) focuses the editor without
// cancelling in-editor text selection.

import type { ComponentProps } from "react";
import { useComposerStore } from "./store";

export type ComposerContainerProps = ComponentProps<"div">;

export const ComposerContainer = ({ children, ...props }: ComposerContainerProps) => {
  const store = useComposerStore();

  const handleMouseDown = (event: React.MouseEvent<HTMLDivElement>) => {
    const target = event.target as HTMLElement;
    // The editor and interactive controls own their mouse behavior. Calling
    // preventDefault on a mousedown inside the editable area would cancel the
    // browser's text-selection drag, so only hijack focus when the click lands
    // on the surrounding chrome.
    if (target.closest("button, a, input, [data-slot='composer-editor']")) {
      return;
    }

    event.preventDefault();
    store.controller.ensureFocus();
  };

  return (
    <div
      role="button"
      tabIndex={0}
      data-slot="composer-container"
      onMouseDown={handleMouseDown}
      {...props}
    >
      {children}
    </div>
  );
};
