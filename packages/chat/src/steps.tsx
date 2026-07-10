"use client";

// Headless steps timeline — a recursive disclosure tree. Every node is the
// same part (Item = a Collapsible; Trigger/Panel scope to the nearest Item by
// nesting), so timelines nest arbitrarily: a panel can contain further items.
// State surfaces as data attributes only: data-status per item, data-open /
// data-closed from the disclosure, and data-nested on items that sit inside
// another item (for rail/connector styling; sibling facts are CSS's job via
// :last-child / :only-child). Icons, connectors, markdown, and all classes
// belong to the styled layer; tool derivation belongs to the app layer.

import { type ComponentProps, createContext, use } from "react";
import { Collapsible } from "./internal/collapsible";
import type { PrimitiveProps } from "./internal/primitive-props";
import { useRenderElement } from "./internal/render/useRenderElement";

// ---------------------------------------------------------------------------
// Root — a plain container. A collapse-everything timeline is just a
// top-level Item the consumer (or the styled layer) opts into.
// ---------------------------------------------------------------------------

export type StepsRootProps = PrimitiveProps<"div">;

const StepsRoot = ({ className, render, style, ...elementProps }: StepsRootProps) =>
  useRenderElement(
    "div",
    { className, render, style },
    { props: [{ "data-steps": "" }, elementProps] },
  );

StepsRoot.displayName = "Steps";

// ---------------------------------------------------------------------------
// Item — one disclosure node. Presence-nested: items inside another item
// carry data-nested.
// ---------------------------------------------------------------------------

// True inside any Item, so deeper items can surface data-nested.
const NestedContext = createContext(false);

// Status inherited by Icon / Label from the nearest Item.
const StepStatusContext = createContext<StepStatus | null>(null);

// Opaque status string — the consumer owns the concrete set (commonly
// "complete" | "active" | "pending"). Surfaced as data-status for styling.
export type StepStatus = string;

const useStepStatus = (status?: StepStatus): StepStatus => {
  const inherited = use(StepStatusContext);
  return status ?? inherited ?? "complete";
};

export type StepsItemProps = ComponentProps<typeof Collapsible> & {
  status?: StepStatus;
};

const StepsItem = ({ status = "complete", defaultOpen, ...props }: StepsItemProps) => {
  const isNested = use(NestedContext);

  return (
    <NestedContext value={true}>
      <StepStatusContext value={status}>
        <Collapsible
          defaultOpen={defaultOpen ?? status === "active"}
          data-steps-item=""
          data-status={status}
          data-nested={isNested || undefined}
          {...props}
        />
      </StepStatusContext>
    </NestedContext>
  );
};

StepsItem.displayName = "StepsItem";

export type StepsTriggerProps = ComponentProps<typeof Collapsible.Trigger>;

const StepsTrigger = (props: StepsTriggerProps) => (
  <Collapsible.Trigger data-steps-trigger="" {...props} />
);

StepsTrigger.displayName = "StepsTrigger";

export type StepsPanelProps = ComponentProps<typeof Collapsible.Panel>;

const StepsPanel = (props: StepsPanelProps) => <Collapsible.Panel data-steps-panel="" {...props} />;

StepsPanel.displayName = "StepsPanel";

// ---------------------------------------------------------------------------
// Icon / Label — timeline row parts. Status comes from an optional prop or
// the nearest Item ancestor.
// ---------------------------------------------------------------------------

export type StepsIconProps = PrimitiveProps<"span", { status: StepStatus }> & {
  status?: StepStatus;
};

const StepsIcon = ({ status, className, render, style, ...elementProps }: StepsIconProps) => {
  const resolvedStatus = useStepStatus(status);

  return useRenderElement(
    "span",
    { className, render, style },
    {
      state: { status: resolvedStatus },
      props: [{ "data-steps-icon": "", "aria-hidden": true }, elementProps],
    },
  );
};

StepsIcon.displayName = "StepsIcon";

export type StepsLabelProps = PrimitiveProps<"span", { status: StepStatus }> & {
  status?: StepStatus;
};

const StepsLabel = ({ status, className, render, style, ...elementProps }: StepsLabelProps) => {
  const resolvedStatus = useStepStatus(status);

  return useRenderElement(
    "span",
    { className, render, style },
    {
      state: { status: resolvedStatus },
      props: [{ "data-steps-label": "" }, elementProps],
    },
  );
};

StepsLabel.displayName = "StepsLabel";

// ---------------------------------------------------------------------------
// Compound export
// ---------------------------------------------------------------------------

export const Steps = Object.assign(StepsRoot, {
  Item: StepsItem,
  Trigger: StepsTrigger,
  Panel: StepsPanel,
  Icon: StepsIcon,
  Label: StepsLabel,
});
