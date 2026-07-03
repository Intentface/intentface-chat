"use client";

// Composer.Panel — owns which panel content is active: the command-list
// override, the matched Composer.PanelItem child, and the store mirror that
// lets siblings (the context window) yield while a panel is open. The open/
// close transition is presentation: the styled layer supplies renderContent
// and composes its own motion around the matched child.

import { Children, type ComponentProps, isValidElement, type ReactNode, useEffect } from "react";
import { useComposer, useComposerStore } from "./store";

export type ComposerPanelProps = Omit<ComponentProps<"div">, "children"> & {
  value?: string;
  children?: ReactNode;
  /**
   * Presentation inversion: receives the matched panel child (or null) and
   * whether a match exists; compose your open/close transition around it.
   * Without it, the matched child renders directly.
   */
  renderContent?: (matchedChild: ReactNode, hasMatch: boolean) => ReactNode;
};

export const ComposerPanel = ({ children, value, renderContent, ...props }: ComposerPanelProps) => {
  const store = useComposerStore();
  const isCommandListOpen = useComposer((composer) => composer.commands.isOpen);

  // When a command-list prefix is active, route the panel to its
  // "command-list" item regardless of what the consumer passed.
  const effectiveValue = isCommandListOpen ? "command-list" : value;

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

  return (
    <div data-slot="composer-panel" data-open={hasMatch || undefined} {...props}>
      {renderContent
        ? renderContent(matchedChild ?? null, hasMatch)
        : hasMatch
          ? matchedChild
          : null}
    </div>
  );
};

export type ComposerPanelItemProps = ComponentProps<"div"> & {
  value: string;
};

export const ComposerPanelItem = ({ value, children, ...props }: ComposerPanelItemProps) => (
  <div key={value} data-slot="composer-panel-item" {...props}>
    {children}
  </div>
);
