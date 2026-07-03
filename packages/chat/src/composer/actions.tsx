"use client";

// Composer.ContextWindow / Actions / Submit. ContextWindow exposes its
// visibility as data-visible (yields to an open panel); Submit owns the
// send↔stop behavior via useComposerSubmit and renders a plain button — the
// styled layer applies the same hook to its own button component.

import { Children, type ComponentProps, useEffect } from "react";
import { useAsRef } from "./internals";
import { useComposer } from "./store";

export type ComposerContextWindowProps = ComponentProps<"div">;

export const ComposerContextWindow = ({ children, ...props }: ComposerContextWindowProps) => {
  const isPanelOpen = useComposer((composer) => composer.panel.isOpen);
  const hasContent = Children.toArray(children).length > 0;
  // Yield to an open panel — the strip slides back out once it closes.
  const isVisible = hasContent && !isPanelOpen;
  return (
    <div data-slot="composer-context-window" data-visible={isVisible || undefined} {...props}>
      {children}
    </div>
  );
};

export type ComposerActionsProps = ComponentProps<"div">;

export const ComposerActions = (props: ComposerActionsProps) => (
  <div data-slot="composer-actions" {...props} />
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

export type ComposerSubmitProps = ComponentProps<"button"> & {
  // While generating, the button morphs into a stop control: the type flips
  // to "button" and clicking it (or pressing Escape) calls onStop instead of
  // submitting the form.
  isGenerating?: boolean;
  onStop?: () => void;
};

export const ComposerSubmit = ({
  children,
  disabled,
  isGenerating = false,
  onStop,
  onClick,
  ...props
}: ComposerSubmitProps) => {
  const submit = useComposerSubmit({ isGenerating, onStop, disabled });

  return (
    <button
      type={submit.type}
      data-slot="composer-submit"
      data-generating={isGenerating ? "" : undefined}
      aria-label={isGenerating ? "Stop generating" : undefined}
      disabled={submit.disabled}
      onClick={isGenerating ? () => onStop?.() : onClick}
      {...props}
    >
      {children}
    </button>
  );
};
