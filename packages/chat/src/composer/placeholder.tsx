"use client";

// Composer.Placeholder — the textarea's empty-state overlay content. Renders a
// plain element with a data-slot; it carries no styling. Rotating through
// several placeholders (and any crossfade) is a presentation concern and lives
// in the styled layer, not here.

import type { ReactNode } from "react";

export type ComposerPlaceholderProps =
  | { placeholder: string; children?: never; className?: string }
  | { placeholder?: never; children: ReactNode; className?: string };

export const ComposerPlaceholder = ({
  placeholder,
  children,
  className,
}: ComposerPlaceholderProps) => (
  <div data-slot="composer-placeholder-text" className={className}>
    {placeholder ?? children}
  </div>
);
