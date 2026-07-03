"use client";

// Minimal internal disclosure primitive — replaces the @base-ui/react
// Collapsible dependency for the package's own parts. Trigger toggles, Panel
// hides (or unmounts) its content; state is exposed via data-state /
// data-panel-open attributes for CSS.

import { type ComponentProps, createContext, use, useCallback, useId, useState } from "react";

type CollapsibleContextValue = {
  open: boolean;
  setOpen: (open: boolean) => void;
  panelId: string;
};

const CollapsibleContext = createContext<CollapsibleContextValue | null>(null);

const useCollapsible = () => {
  const ctx = use(CollapsibleContext);
  if (!ctx) throw new Error("Collapsible parts must be used within <Collapsible>");
  return ctx;
};

export type CollapsibleRootProps = ComponentProps<"div"> & {
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
};

const CollapsibleRoot = ({
  open: controlledOpen,
  defaultOpen = false,
  onOpenChange,
  ...props
}: CollapsibleRootProps) => {
  const [internalOpen, setInternalOpen] = useState(defaultOpen);
  const isControlled = controlledOpen !== undefined;
  const open = isControlled ? controlledOpen : internalOpen;
  const panelId = useId();

  const setOpen = useCallback(
    (value: boolean) => {
      if (!isControlled) setInternalOpen(value);
      onOpenChange?.(value);
    },
    [isControlled, onOpenChange],
  );

  return (
    <CollapsibleContext value={{ open, setOpen, panelId }}>
      <div data-state={open ? "open" : "closed"} {...props} />
    </CollapsibleContext>
  );
};

export type CollapsibleTriggerProps = ComponentProps<"button">;

const CollapsibleTrigger = ({ onClick, ...props }: CollapsibleTriggerProps) => {
  const { open, setOpen, panelId } = useCollapsible();

  return (
    <button
      type="button"
      aria-expanded={open}
      aria-controls={panelId}
      data-state={open ? "open" : "closed"}
      data-panel-open={open || undefined}
      onClick={(event) => {
        onClick?.(event);
        if (!event.defaultPrevented) setOpen(!open);
      }}
      {...props}
    />
  );
};

export type CollapsiblePanelProps = ComponentProps<"div"> & {
  /** Keep the panel in the DOM (hidden) when closed. */
  keepMounted?: boolean;
};

const CollapsiblePanel = ({ keepMounted = false, ...props }: CollapsiblePanelProps) => {
  const { open, panelId } = useCollapsible();

  if (!open && !keepMounted) return null;

  return <div id={panelId} data-state={open ? "open" : "closed"} hidden={!open} {...props} />;
};

export const Collapsible = Object.assign(CollapsibleRoot, {
  Trigger: CollapsibleTrigger,
  Panel: CollapsiblePanel,
});
