"use client";

// Composer.ContextWindow / Actions / Submit. ContextWindow exposes its
// visibility as data-visible (yields to an open panel); Submit owns the
// send↔stop behavior via useComposerSubmit and renders a plain button — the
// styled layer applies the same hook to its own button component.

import { Children, useEffect } from "react";
import type { PrimitiveProps } from "../internal/primitive-props";
import { useRenderElement } from "../internal/render/useRenderElement";
import { useAsRef } from "./internals";
import { useComposer } from "./store";

export type ComposerContextWindowState = {
  /** Present as data-visible while the strip has content and no panel is open. */
  visible: boolean;
};

export type ComposerContextWindowProps = PrimitiveProps<"div", ComposerContextWindowState>;

export const ComposerContextWindow = ({
  children,
  className,
  render,
  style,
  ...elementProps
}: ComposerContextWindowProps) => {
  // Yield while any native panel is active — the strip slides back out once they
  // close. (Union of the native slices; no central registry.)
  const anyPanelActive = useComposer(
    (composer) => composer.commands.active || composer.askUser.active,
  );
  const hasContent = Children.toArray(children).length > 0;
  const isVisible = hasContent && !anyPanelActive;

  return useRenderElement(
    "div",
    { className, render, style },
    {
      state: { visible: isVisible },
      props: [{ "data-slot": "composer-context-window", children }, elementProps],
    },
  );
};

export type ComposerActionsProps = PrimitiveProps<"div">;

export const ComposerActions = ({
  className,
  render,
  style,
  ...elementProps
}: ComposerActionsProps) =>
  useRenderElement(
    "div",
    { className, render, style },
    { props: [{ "data-slot": "composer-actions" }, elementProps] },
  );

export type UseComposerSubmitOptions = {
  isGenerating?: boolean;
  onStop?: () => void;
  disabled?: boolean;
};

export type ComposerSubmitState = {
  /** "button" while generating (click stops), "submit" otherwise. */
  type: "button" | "submit";
  disabled: boolean;
  isGenerating: boolean;
};

/**
 * Send↔stop behavior: auto-disables while empty or submitting, flips the
 * button type while generating, and aborts on Escape (unless something closer
 * — the command list — already handled it).
 */
export const useComposerSubmit = ({
  isGenerating = false,
  onStop,
  disabled,
}: UseComposerSubmitOptions): ComposerSubmitState => {
  const hasContent = useComposer((composer) => composer.textarea.hasContent);
  const isSubmitting = useComposer((composer) => composer.isSubmitting);
  const attachments = useComposer((composer) => composer.attachments);

  // Esc aborts while generating — unless something already handled it (the
  // command-list closes on Esc and preventDefaults first, so it wins).
  const onStopRef = useAsRef(onStop);
  useEffect(() => {
    if (!isGenerating) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || event.defaultPrevented) return;
      event.preventDefault();
      onStopRef.current?.();
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isGenerating]);

  const autoDisabled =
    disabled ?? ((!hasContent && attachments.items.length === 0) || isSubmitting);

  return {
    type: isGenerating ? "button" : "submit",
    disabled: isGenerating ? false : autoDisabled,
    isGenerating,
  };
};

export type ComposerSubmitButtonState = {
  /** Present as data-generating while the stop affordance is active. */
  generating: boolean;
};

export type ComposerSubmitProps = PrimitiveProps<"button", ComposerSubmitButtonState> & {
  // While generating, the button morphs into a stop control: the type flips
  // to "button" and clicking it (or pressing Escape) calls onStop instead of
  // submitting the form.
  isGenerating?: boolean;
  onStop?: () => void;
};

export const ComposerSubmit = ({
  disabled,
  isGenerating = false,
  onStop,
  onClick,
  className,
  render,
  style,
  ...elementProps
}: ComposerSubmitProps) => {
  const submit = useComposerSubmit({ isGenerating, onStop, disabled });

  return useRenderElement(
    "button",
    { className, render, style },
    {
      state: { generating: isGenerating },
      props: [
        {
          type: submit.type,
          "data-slot": "composer-submit",
          "aria-label": isGenerating ? "Stop generating" : undefined,
          disabled: submit.disabled,
          // Replaces (not chains) the consumer's onClick while generating —
          // a stop click must never fall through to submit handlers.
          onClick: isGenerating ? () => onStop?.() : onClick,
        },
        elementProps,
      ],
    },
  );
};
