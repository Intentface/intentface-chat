"use client";

// Composer.Placeholder — resolves the placeholder items and owns the rotation
// timer. The headless render is a plain span keyed by the loop tick; the
// styled layer composes its own crossfade from useComposerPlaceholder.

import { Children, type ReactNode, useMemo } from "react";
import { useLoop } from "../internal/use-loop";

export type ComposerPlaceholderProps =
  | { placeholder: string | string[]; children?: never; className?: string }
  | { placeholder?: never; children: ReactNode; className?: string };

export type ComposerPlaceholderState = {
  items: ReactNode[];
  isLooping: boolean;
  /** The current string item while looping (string arrays only). */
  currentItem: string | undefined;
  /** Increments on every rotation — key your crossfade element with it. */
  key: number;
};

export const useComposerPlaceholder = (
  placeholder: string | string[] | undefined,
  children: ReactNode | undefined,
  delay = 3000,
): ComposerPlaceholderState => {
  const items = useMemo(() => {
    if (placeholder !== undefined) {
      return Array.isArray(placeholder) ? placeholder : [placeholder];
    }
    if (children) return Children.toArray(children);
    return [];
  }, [placeholder, children]);

  const isLooping = items.length > 1;

  const loopItems = useMemo(
    () => items.map((item) => (typeof item === "string" ? item : "")),
    [items],
  );
  const { currentItem, key } = useLoop(loopItems, delay);

  return { items, isLooping, currentItem, key };
};

export const ComposerPlaceholder = ({
  placeholder,
  children,
  className,
}: ComposerPlaceholderProps) => {
  const { items, isLooping, currentItem, key } = useComposerPlaceholder(placeholder, children);

  if (!isLooping && items.length === 1) {
    return (
      <div data-slot="composer-placeholder-text" className={className}>
        {items[0]}
      </div>
    );
  }

  if (!isLooping && items.length === 0) return null;

  return (
    <span key={key} data-slot="composer-placeholder-text" className={className}>
      {typeof items[0] === "string" ? currentItem : items[key % items.length]}
    </span>
  );
};
