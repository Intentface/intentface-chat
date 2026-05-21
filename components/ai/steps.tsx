"use client";

import { CircleHelpIcon, CircleIcon } from "lucide-react";
import {
  Children,
  type ComponentProps,
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useMemo,
  useState,
} from "react";
import { CheckMarkMediumIcon } from "@/components/icons/check-mark-medium";
import { ChevronDownIcon } from "@/components/icons/chevron-down";
import { Collapsible } from "@/components/ui/collapsible";
import { Markdown } from "@/components/ui/markdown";
import {
  DEFAULT_TOOL_LABELS,
  type ToolLabels,
  type ToolPart,
} from "@/lib/message-utils";
import { cn } from "@/lib/utils";
import type { AskUserInput, AskUserQuestion } from "@/tools/ask-user";

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------

type StepsContextValue = {
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
  toolLabels: ToolLabels;
};

const StepsContext = createContext<StepsContextValue | null>(null);

const useSteps = () => {
  const context = useContext(StepsContext);
  if (!context) {
    throw new Error("Steps components must be used within Steps");
  }
  return context;
};

// ---------------------------------------------------------------------------
// Root
// ---------------------------------------------------------------------------

type StepsRootProps = Omit<ComponentProps<"div">, "defaultOpen"> & {
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  toolLabels?: ToolLabels;
};

const StepsRoot = ({
  open: controlledOpen,
  defaultOpen = false,
  onOpenChange,
  toolLabels = DEFAULT_TOOL_LABELS,
  className,
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
    <StepsContext.Provider value={contextValue}>
      <Collapsible
        open={isOpen}
        onOpenChange={(open) => setIsOpen(open)}
        data-slot="steps"
        className={cn("not-prose w-full", className)}
        {...props}
      >
        {children}
      </Collapsible>
    </StepsContext.Provider>
  );
};

StepsRoot.displayName = "Steps";

// ---------------------------------------------------------------------------
// Header (trigger for outer collapsible)
// ---------------------------------------------------------------------------

type StepsHeaderProps = ComponentProps<typeof Collapsible.Trigger>;

const StepsHeader = ({ children, className, ...props }: StepsHeaderProps) => {
  const { isOpen } = useSteps();

  return (
    <Collapsible.Trigger
      className={cn(
        "flex w-full cursor-pointer items-center gap-2 py-1 text-sm text-ink-secondary transition-colors hover:text-ink-primary",
        className,
      )}
      {...props}
    >
      {children ?? "Steps"}
      <ChevronDownIcon
        className={cn(
          "size-4 shrink-0 transition-transform",
          isOpen ? "rotate-180" : "rotate-0",
        )}
      />
    </Collapsible.Trigger>
  );
};

StepsHeader.displayName = "StepsHeader";

// ---------------------------------------------------------------------------
// Content (panel for outer collapsible — timeline container)
// ---------------------------------------------------------------------------

type StepsContentProps = ComponentProps<typeof Collapsible.Panel>;

const StepsContent = ({ className, children, ...props }: StepsContentProps) => (
  <Collapsible.Panel className={cn("mt-2", className)} {...props}>
    <div className="flex flex-col [&>:last-child_[data-slot=step-connector]]:hidden">
      {children}
    </div>
  </Collapsible.Panel>
);

StepsContent.displayName = "StepsContent";

// ---------------------------------------------------------------------------
// Step — collapsible timeline item
//
// When children are present the label becomes a collapsible trigger and the
// children render below with a vertical connector line on the left. When
// there are no children the step is a static row (no collapse).
// ---------------------------------------------------------------------------

type StepStatus = "complete" | "active" | "pending";

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

const StepsStep = ({
  label,
  status = "complete",
  icon,
  className,
  children,
}: StepsStepProps) => {
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
      <div data-slot="steps-step" data-status={status} className={className}>
        <div className="flex items-center gap-2 py-0.5">
          <div
            className={cn(
              "flex size-4 shrink-0 items-center justify-center",
              iconClasses,
            )}
          >
            <Icon
              className={cn("size-3.5", status === "active" && "animate-pulse")}
            />
          </div>
          <span className={labelClasses}>{label}</span>
        </div>
        {connector}
      </div>
    );
  }

  // Collapsible row — trigger swaps icon ↔ chevron on hover/open
  return (
    <Collapsible
      defaultOpen={status === "active"}
      data-slot="steps-step"
      data-status={status}
      className={className}
    >
      <Collapsible.Trigger className="group/trigger flex w-full cursor-pointer items-center gap-2 py-0.5 transition-colors hover:text-ink-primary">
        <div
          className={cn(
            "relative flex size-4 shrink-0 items-center justify-center",
            iconClasses,
          )}
        >
          {/* Status icon — hides on hover and when panel is open */}
          <span className="transition-opacity group-hover/trigger:opacity-0 group-data-[panel-open]/trigger:opacity-0">
            <Icon
              className={cn("size-3.5", status === "active" && "animate-pulse")}
            />
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
      </Collapsible.Trigger>

      <Collapsible.Panel>
        <div className="flex gap-2">
          <div className="flex w-4 justify-center">
            <div className="w-px bg-slate-6" />
          </div>
          <div className="min-w-0 flex-1 py-1">{children}</div>
        </div>
      </Collapsible.Panel>

      {connector}
    </Collapsible>
  );
};

StepsStep.displayName = "StepsStep";

// ---------------------------------------------------------------------------
// Body — markdown content inside a step's collapsible area
// ---------------------------------------------------------------------------

type StepsBodyProps = ComponentProps<typeof Markdown>;

const StepsBody = ({ className, children, ...props }: StepsBodyProps) => (
  <Markdown
    className={cn(
      "text-sm leading-tight text-ink-secondary [&_p]:mb-0",
      className,
    )}
    {...props}
  >
    {children}
  </Markdown>
);

StepsBody.displayName = "StepsBody";

// ---------------------------------------------------------------------------
// Summary (compact result text)
// ---------------------------------------------------------------------------

type StepsSummaryProps = ComponentProps<"span">;

const StepsSummary = ({ className, children, ...props }: StepsSummaryProps) => (
  <span
    data-slot="steps-summary"
    className={cn("text-xs text-ink-secondary", className)}
    {...props}
  >
    {children}
  </span>
);

StepsSummary.displayName = "StepsSummary";

// ---------------------------------------------------------------------------
// SearchResults / SearchResult
// ---------------------------------------------------------------------------

type StepsSearchResultsProps = ComponentProps<"div">;

const StepsSearchResults = ({
  className,
  children,
  ...props
}: StepsSearchResultsProps) => (
  <div
    data-slot="steps-search-results"
    className={cn("flex flex-wrap gap-1.5", className)}
    {...props}
  >
    {children}
  </div>
);

StepsSearchResults.displayName = "StepsSearchResults";

type StepsSearchResultProps = ComponentProps<"span">;

const StepsSearchResult = ({
  className,
  children,
  ...props
}: StepsSearchResultProps) => (
  <span
    data-slot="steps-search-result"
    className={cn(
      "inline-flex items-center rounded-md border border-border bg-muted px-2 py-0.5 text-xs text-muted-foreground",
      className,
    )}
    {...props}
  >
    {children}
  </span>
);

StepsSearchResult.displayName = "StepsSearchResult";

// ---------------------------------------------------------------------------
// ToolCall — renders a tool invocation as a timeline step
// ---------------------------------------------------------------------------

type WebSearchFinding = {
  claim: string;
  sources: { url: string; title: string }[];
};

type StepsToolCallProps = {
  part: ToolPart;
  className?: string;
};

const StepsToolCall = ({ part, className }: StepsToolCallProps) => {
  const { toolLabels } = useSteps();
  const input = (part.input as Record<string, unknown>) ?? {};
  const isActive =
    part.state === "input-streaming" || part.state === "input-available";
  const isComplete = part.state === "output-available";
  const name = part.type.replace("tool-", "");

  const labelConfig = toolLabels[name];
  const label = labelConfig
    ? isActive
      ? labelConfig.active(input)
      : labelConfig.complete(input)
    : isActive
      ? `Running ${name}`
      : `Ran ${name}`;

  const status: StepStatus = isActive
    ? "active"
    : isComplete
      ? "complete"
      : "pending";

  // Extract summary from tool output
  const output = isComplete ? (part.output as Record<string, unknown>) : null;
  const summary = typeof output?.summary === "string" ? output.summary : null;

  // Flatten sources from web search findings
  const rawOutput =
    isComplete && part.type === "tool-webSearch" ? part.output : null;
  const findings = Array.isArray(rawOutput)
    ? (rawOutput as WebSearchFinding[])
    : [];
  const sources = findings
    .flatMap((f) => f.sources)
    .map((s) => {
      try {
        return { ...s, domain: new URL(s.url).hostname.replace(/^www\./, "") };
      } catch {
        return { ...s, domain: s.title };
      }
    });

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
  const isComplete = part.state === "output-available";
  const input = part.input as AskUserInput | undefined;
  const questions: AskUserQuestion[] = input?.questions ?? [];

  let answers: Record<string, string> = {};
  if (isComplete) {
    try {
      answers = JSON.parse(part.output as string) as Record<string, string>;
    } catch {}
  }

  const count = questions.length;
  const label = `Answered ${count} ${count === 1 ? "question" : "questions"}`;

  return (
    <StepsStep
      label={label}
      status={isComplete ? "complete" : "active"}
      icon={CircleHelpIcon}
      className={className}
    >
      <div className="flex flex-col gap-1.5">
        {questions.map((q) => (
          <div key={q.question} className="flex flex-col gap-0.5">
            <span className="text-xs font-medium leading-tight text-ink-primary">
              {q.question}
            </span>
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
