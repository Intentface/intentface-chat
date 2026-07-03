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
    { props: [{ "data-slot": "steps" }, elementProps] },
  );

StepsRoot.displayName = "Steps";

// ---------------------------------------------------------------------------
// Item — one disclosure node. Presence-nested: items inside another item
// carry data-nested.
// ---------------------------------------------------------------------------

// True inside any Item, so deeper items can surface data-nested.
const NestedContext = createContext(false);

export type StepStatus = "complete" | "active" | "pending";

export type StepsItemProps = ComponentProps<typeof Collapsible> & {
  status?: StepStatus;
};

const StepsItem = ({ status = "complete", defaultOpen, ...props }: StepsItemProps) => {
  const isNested = use(NestedContext);

  return (
    <NestedContext value={true}>
      <Collapsible
        defaultOpen={defaultOpen ?? status === "active"}
        data-slot="steps-item"
        data-status={status}
        data-nested={isNested || undefined}
        {...props}
      />
    </NestedContext>
  );
};

StepsItem.displayName = "StepsItem";

export type StepsTriggerProps = ComponentProps<typeof Collapsible.Trigger>;

const StepsTrigger = (props: StepsTriggerProps) => (
  <Collapsible.Trigger data-slot="steps-trigger" {...props} />
);

StepsTrigger.displayName = "StepsTrigger";

export type StepsPanelProps = ComponentProps<typeof Collapsible.Panel>;

const StepsPanel = (props: StepsPanelProps) => (
  <Collapsible.Panel data-slot="steps-panel" {...props} />
);

StepsPanel.displayName = "StepsPanel";

// ---------------------------------------------------------------------------
// Compound export
// ---------------------------------------------------------------------------

export const Steps = Object.assign(StepsRoot, {
  Item: StepsItem,
  Trigger: StepsTrigger,
  Panel: StepsPanel,
});
