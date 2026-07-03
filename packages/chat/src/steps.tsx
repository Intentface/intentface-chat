"use client";

// Headless steps timeline. Owns the outer disclosure, per-step disclosure
// (data-status), the tool-labels context, and the pure derivation that turns
// tool parts into step info. Icons, connectors, markdown, and all classes
// belong to the styled layer.

import { type ComponentProps, createContext, use, useCallback, useMemo, useState } from "react";
import { Collapsible } from "./internal/collapsible";
import type { PrimitiveProps } from "./internal/primitive-props";
import { useRenderElement } from "./internal/render/useRenderElement";
import type { ToolLabels } from "./message-utils";
import type { AskUserInput, AskUserQuestion, ToolPart } from "./types";

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------

type StepsContextValue = {
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
  toolLabels: ToolLabels;
};

const StepsContext = createContext<StepsContextValue | null>(null);

export const useSteps = () => {
  const context = use(StepsContext);
  if (!context) {
    throw new Error("Steps components must be used within Steps");
  }
  return context;
};

// ---------------------------------------------------------------------------
// Root
// ---------------------------------------------------------------------------

export type StepsRootProps = Omit<
  ComponentProps<typeof Collapsible>,
  "open" | "defaultOpen" | "onOpenChange"
> & {
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  toolLabels?: ToolLabels;
};

const StepsRoot = ({
  open: controlledOpen,
  defaultOpen = false,
  onOpenChange,
  toolLabels = {},
  children,
  ...props
}: StepsRootProps) => {
  const [internalOpen, setInternalOpen] = useState(defaultOpen);
  const isControlled = controlledOpen !== undefined;
  const isOpen = isControlled ? controlledOpen : internalOpen;

  const setIsOpen = useCallback(
    (value: boolean) => {
      if (!isControlled) setInternalOpen(value);
      onOpenChange?.(value);
    },
    [isControlled, onOpenChange],
  );

  const contextValue = useMemo(
    () => ({ isOpen, setIsOpen, toolLabels }),
    [isOpen, setIsOpen, toolLabels],
  );

  return (
    <StepsContext value={contextValue}>
      <Collapsible
        open={isOpen}
        onOpenChange={(open) => setIsOpen(open)}
        data-slot="steps"
        {...props}
      >
        {children}
      </Collapsible>
    </StepsContext>
  );
};

StepsRoot.displayName = "Steps";

// ---------------------------------------------------------------------------
// Header (trigger for the outer disclosure) + Content (its panel)
// ---------------------------------------------------------------------------

export type StepsHeaderProps = ComponentProps<typeof Collapsible.Trigger>;

const StepsHeader = (props: StepsHeaderProps) => (
  <Collapsible.Trigger data-slot="steps-header" {...props} />
);

StepsHeader.displayName = "StepsHeader";

export type StepsContentProps = ComponentProps<typeof Collapsible.Panel>;

const StepsContent = (props: StepsContentProps) => (
  <Collapsible.Panel data-slot="steps-content" {...props} />
);

StepsContent.displayName = "StepsContent";

// ---------------------------------------------------------------------------
// Step — a timeline item with an optional nested disclosure. Renders as a
// plain container when no StepTrigger/StepPanel children are used.
// ---------------------------------------------------------------------------

export type StepStatus = "complete" | "active" | "pending";

export type StepsStepProps = ComponentProps<typeof Collapsible> & {
  status?: StepStatus;
};

const StepsStep = ({ status = "complete", defaultOpen, ...props }: StepsStepProps) => (
  <Collapsible
    defaultOpen={defaultOpen ?? status === "active"}
    data-slot="steps-step"
    data-status={status}
    {...props}
  />
);

StepsStep.displayName = "StepsStep";

export type StepsStepTriggerProps = ComponentProps<typeof Collapsible.Trigger>;

const StepsStepTrigger = (props: StepsStepTriggerProps) => (
  <Collapsible.Trigger data-slot="steps-step-trigger" {...props} />
);

StepsStepTrigger.displayName = "StepsStepTrigger";

export type StepsStepPanelProps = ComponentProps<typeof Collapsible.Panel>;

const StepsStepPanel = (props: StepsStepPanelProps) => (
  <Collapsible.Panel data-slot="steps-step-panel" {...props} />
);

StepsStepPanel.displayName = "StepsStepPanel";

// ---------------------------------------------------------------------------
// Summary / SearchResults / SearchResult — structural leaves
// ---------------------------------------------------------------------------

export type StepsSummaryProps = PrimitiveProps<"span">;

const StepsSummary = ({ className, render, style, ...elementProps }: StepsSummaryProps) =>
  useRenderElement(
    "span",
    { className, render, style },
    { props: [{ "data-slot": "steps-summary" }, elementProps] },
  );

StepsSummary.displayName = "StepsSummary";

export type StepsSearchResultsProps = PrimitiveProps<"div">;

const StepsSearchResults = ({
  className,
  render,
  style,
  ...elementProps
}: StepsSearchResultsProps) =>
  useRenderElement(
    "div",
    { className, render, style },
    { props: [{ "data-slot": "steps-search-results" }, elementProps] },
  );

StepsSearchResults.displayName = "StepsSearchResults";

export type StepsSearchResultProps = PrimitiveProps<"span">;

const StepsSearchResult = ({ className, render, style, ...elementProps }: StepsSearchResultProps) =>
  useRenderElement(
    "span",
    { className, render, style },
    { props: [{ "data-slot": "steps-search-result" }, elementProps] },
  );

StepsSearchResult.displayName = "StepsSearchResult";

// ---------------------------------------------------------------------------
// Pure derivation — tool part → step info
// ---------------------------------------------------------------------------

type WebSearchFinding = {
  claim: string;
  sources: { url: string; title: string }[];
};

export type ToolCallInfo = {
  label: string;
  status: StepStatus;
  summary: string | null;
  sources: { url: string; title: string; domain: string }[];
};

export const getToolCallInfo = (part: ToolPart, labels: ToolLabels = {}): ToolCallInfo => {
  const input = (part.input as Record<string, unknown>) ?? {};
  const isActive = part.state === "input-streaming" || part.state === "input-available";
  const isComplete = part.state === "output-available";
  const name = part.type.replace("tool-", "");

  const labelConfig = labels[name];
  const label = labelConfig
    ? isActive
      ? labelConfig.active(input)
      : labelConfig.complete(input)
    : isActive
      ? `Running ${name}`
      : `Ran ${name}`;

  const status: StepStatus = isActive ? "active" : isComplete ? "complete" : "pending";

  // Extract summary from tool output
  const output = isComplete ? (part.output as Record<string, unknown>) : null;
  const summary = typeof output?.summary === "string" ? output.summary : null;

  // Flatten sources from web search findings
  const rawOutput = isComplete && part.type === "tool-webSearch" ? part.output : null;
  const findings = Array.isArray(rawOutput) ? (rawOutput as WebSearchFinding[]) : [];
  const sources = findings
    .flatMap((f) => f.sources)
    .map((s) => {
      try {
        return { ...s, domain: new URL(s.url).hostname.replace(/^www\./, "") };
      } catch {
        return { ...s, domain: s.title };
      }
    });

  return { label, status, summary, sources };
};

export type AskUserStepInfo = {
  label: string;
  status: StepStatus;
  questions: AskUserQuestion[];
  answers: Record<string, string>;
  isComplete: boolean;
};

export const getAskUserStepInfo = (part: ToolPart): AskUserStepInfo => {
  const isComplete = part.state === "output-available";
  const input = part.input as AskUserInput | undefined;
  const questions: AskUserQuestion[] = input?.questions ?? [];

  let answers: Record<string, string> = {};
  if (isComplete) {
    try {
      answers = JSON.parse(part.output as string) as Record<string, string>;
    } catch (error) {
      console.error("Failed to parse askUser output", {
        output: part.output,
        error,
      });
    }
  }

  const count = questions.length;
  const label = `Answered ${count} ${count === 1 ? "question" : "questions"}`;

  return { label, status: isComplete ? "complete" : "active", questions, answers, isComplete };
};

// ---------------------------------------------------------------------------
// Compound export
// ---------------------------------------------------------------------------

export const Steps = Object.assign(StepsRoot, {
  Header: StepsHeader,
  Content: StepsContent,
  Step: StepsStep,
  StepTrigger: StepsStepTrigger,
  StepPanel: StepsStepPanel,
  Summary: StepsSummary,
  SearchResults: StepsSearchResults,
  SearchResult: StepsSearchResult,
});
