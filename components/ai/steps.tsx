"use client";

import {
  getAskUserStepInfo,
  getToolCallInfo,
  type StepStatus,
  Steps as StepsPrimitive,
  useSteps,
} from "@intentface/chat/steps";
import type { ToolPart } from "@intentface/chat/types";
import { CircleHelpIcon, CircleIcon } from "lucide-react";
import { Children, type ComponentProps, type ReactNode } from "react";
import { CheckMarkMediumIcon } from "@/components/icons/check-mark-medium";
import { ChevronDownIcon } from "@/components/icons/chevron-down";
import { Markdown } from "@/components/ui/markdown";
import { DEFAULT_TOOL_LABELS } from "@/lib/ai/tool-labels";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Root
// ---------------------------------------------------------------------------

type StepsRootProps = ComponentProps<typeof StepsPrimitive>;

const StepsRoot = ({ toolLabels = DEFAULT_TOOL_LABELS, className, ...props }: StepsRootProps) => (
  <StepsPrimitive
    toolLabels={toolLabels}
    className={cn("not-prose w-full", className)}
    {...props}
  />
);

StepsRoot.displayName = "Steps";

// ---------------------------------------------------------------------------
// Header (trigger for outer collapsible)
// ---------------------------------------------------------------------------

type StepsHeaderProps = ComponentProps<typeof StepsPrimitive.Header>;

const StepsHeader = ({ children, className, ...props }: StepsHeaderProps) => {
  const { isOpen } = useSteps();

  return (
    <StepsPrimitive.Header
      className={cn(
        "flex w-full cursor-pointer items-center gap-2 py-1 text-sm text-ink-secondary transition-colors hover:text-ink-primary",
        className,
      )}
      {...props}
    >
      {children ?? "Steps"}
      <ChevronDownIcon
        className={cn("size-4 shrink-0 transition-transform", isOpen ? "rotate-180" : "rotate-0")}
      />
    </StepsPrimitive.Header>
  );
};

StepsHeader.displayName = "StepsHeader";

// ---------------------------------------------------------------------------
// Content (panel for outer collapsible — timeline container)
// ---------------------------------------------------------------------------

type StepsContentProps = ComponentProps<typeof StepsPrimitive.Content>;

const StepsContent = ({ className, children, ...props }: StepsContentProps) => (
  <StepsPrimitive.Content className={cn("mt-2", className)} {...props}>
    <div className="flex flex-col [&>:last-child_[data-slot=step-connector]]:hidden">
      {children}
    </div>
  </StepsPrimitive.Content>
);

StepsContent.displayName = "StepsContent";

// ---------------------------------------------------------------------------
// Step — collapsible timeline item
//
// When children are present the label becomes a collapsible trigger and the
// children render below with a vertical connector line on the left. When
// there are no children the step is a static row (no collapse).
// ---------------------------------------------------------------------------

type IconComponent = React.ComponentType<{ className?: string }>;

const statusIcons: Record<StepStatus, IconComponent> = {
  complete: CheckMarkMediumIcon,
  active: CircleIcon,
  pending: CircleIcon,
};

type StepsStepProps = {
  label: string;
  status?: StepStatus;
  icon?: IconComponent;
  className?: string;
  children?: ReactNode;
};

const StepsStep = ({ label, status = "complete", icon, className, children }: StepsStepProps) => {
  const Icon = icon ?? statusIcons[status];
  const hasContent = Children.toArray(children).length > 0;

  const iconClasses = cn(
    status === "complete" && "text-ink-secondary",
    status === "active" && "text-ink-primary",
    status === "pending" && "text-slate-9",
  );

  const labelClasses = cn(
    "text-sm text-left",
    status === "active" && "text-ink-primary font-medium",
    status === "complete" && "text-ink-secondary",
    status === "pending" && "text-slate-9",
  );

  const connector = (
    <div data-slot="step-connector" className="flex">
      <div className="flex w-4 justify-center">
        <div className="h-3 w-px bg-slate-6" />
      </div>
    </div>
  );

  // Static row — no children, not collapsible
  if (!hasContent) {
    return (
      <StepsPrimitive.Step status={status} className={className}>
        <div className="flex items-center gap-2 py-0.5">
          <div className={cn("flex size-4 shrink-0 items-center justify-center", iconClasses)}>
            <Icon className={cn("size-3.5", status === "active" && "animate-pulse")} />
          </div>
          <span className={labelClasses}>{label}</span>
        </div>
        {connector}
      </StepsPrimitive.Step>
    );
  }

  // Collapsible row — trigger swaps icon ↔ chevron on hover/open
  return (
    <StepsPrimitive.Step status={status} className={className}>
      <StepsPrimitive.StepTrigger className="group/trigger flex w-full cursor-pointer items-center gap-2 py-0.5 transition-colors hover:text-ink-primary">
        <div
          className={cn("relative flex size-4 shrink-0 items-center justify-center", iconClasses)}
        >
          {/* Status icon — hides on hover and when panel is open */}
          <span className="transition-opacity group-hover/trigger:opacity-0 group-data-[panel-open]/trigger:opacity-0">
            <Icon className={cn("size-3.5", status === "active" && "animate-pulse")} />
          </span>
          {/* Chevron — appears on hover, stays visible when open, rotates 180° */}
          <ChevronDownIcon
            className={cn(
              "absolute size-4 opacity-0 transition-all",
              "group-hover/trigger:opacity-100",
              "group-data-panel-open/trigger:opacity-100",
              "group-data-panel-open/trigger:rotate-180",
            )}
          />
        </div>
        <span className={labelClasses}>{label}</span>
      </StepsPrimitive.StepTrigger>

      <StepsPrimitive.StepPanel>
        <div className="flex gap-2">
          <div className="flex w-4 justify-center">
            <div className="w-px bg-slate-6" />
          </div>
          <div className="min-w-0 flex-1 py-1">{children}</div>
        </div>
      </StepsPrimitive.StepPanel>

      {connector}
    </StepsPrimitive.Step>
  );
};

StepsStep.displayName = "StepsStep";

// ---------------------------------------------------------------------------
// Body — markdown content inside a step's collapsible area
// ---------------------------------------------------------------------------

type StepsBodyProps = ComponentProps<typeof Markdown>;

const StepsBody = ({ className, children, ...props }: StepsBodyProps) => (
  <Markdown
    className={cn("text-sm leading-tight text-ink-secondary [&_p]:mb-0", className)}
    {...props}
  >
    {children}
  </Markdown>
);

StepsBody.displayName = "StepsBody";

// ---------------------------------------------------------------------------
// Summary (compact result text)
// ---------------------------------------------------------------------------

type StepsSummaryProps = ComponentProps<typeof StepsPrimitive.Summary>;

const StepsSummary = ({ className, ...props }: StepsSummaryProps) => (
  <StepsPrimitive.Summary className={cn("text-xs text-ink-secondary", className)} {...props} />
);

StepsSummary.displayName = "StepsSummary";

// ---------------------------------------------------------------------------
// SearchResults / SearchResult
// ---------------------------------------------------------------------------

type StepsSearchResultsProps = ComponentProps<typeof StepsPrimitive.SearchResults>;

const StepsSearchResults = ({ className, ...props }: StepsSearchResultsProps) => (
  <StepsPrimitive.SearchResults className={cn("flex flex-wrap gap-1.5", className)} {...props} />
);

StepsSearchResults.displayName = "StepsSearchResults";

type StepsSearchResultProps = ComponentProps<typeof StepsPrimitive.SearchResult>;

const StepsSearchResult = ({ className, ...props }: StepsSearchResultProps) => (
  <StepsPrimitive.SearchResult
    className={cn(
      "inline-flex items-center rounded-md border border-border bg-muted px-2 py-0.5 text-xs text-muted-foreground",
      className,
    )}
    {...props}
  />
);

StepsSearchResult.displayName = "StepsSearchResult";

// ---------------------------------------------------------------------------
// ToolCall — renders a tool invocation as a timeline step
// ---------------------------------------------------------------------------

type StepsToolCallProps = {
  part: ToolPart;
  className?: string;
};

const StepsToolCall = ({ part, className }: StepsToolCallProps) => {
  const { toolLabels } = useSteps();
  const { label, status, summary, sources } = getToolCallInfo(part, toolLabels);

  return (
    <StepsStep label={label} status={status} className={className}>
      {summary && <StepsSummary>{summary}</StepsSummary>}
      {sources.length > 0 && (
        <StepsSearchResults>
          {sources.map((source, index) => (
            <StepsSearchResult key={index}>{source.domain}</StepsSearchResult>
          ))}
        </StepsSearchResults>
      )}
    </StepsStep>
  );
};

StepsToolCall.displayName = "StepsToolCall";

// ---------------------------------------------------------------------------
// AskUser — renders an answered ask-user exchange as a timeline step
// ---------------------------------------------------------------------------

type StepsAskUserProps = {
  part: ToolPart;
  className?: string;
};

const StepsAskUser = ({ part, className }: StepsAskUserProps) => {
  const { label, status, questions, answers, isComplete } = getAskUserStepInfo(part);

  return (
    <StepsStep label={label} status={status} icon={CircleHelpIcon} className={className}>
      <div className="flex flex-col gap-1.5">
        {questions.map((q) => (
          <div key={q.question} className="flex flex-col gap-0.5">
            <span className="text-xs font-medium leading-tight text-ink-primary">{q.question}</span>
            {isComplete && (
              <span className="text-xs leading-tight text-ink-secondary">
                {answers[q.question] ?? "—"}
              </span>
            )}
          </div>
        ))}
      </div>
    </StepsStep>
  );
};

StepsAskUser.displayName = "StepsAskUser";

// ---------------------------------------------------------------------------
// Compound export
// ---------------------------------------------------------------------------

export const Steps = Object.assign(StepsRoot, {
  Header: StepsHeader,
  Content: StepsContent,
  Step: StepsStep,
  Body: StepsBody,
  ToolCall: StepsToolCall,
  AskUser: StepsAskUser,
  Summary: StepsSummary,
  SearchResults: StepsSearchResults,
  SearchResult: StepsSearchResult,
});
