"use client";

import {
  ChevronLeftIcon,
  ChevronRightIcon,
  CircleHelpIcon,
  SendIcon,
} from "lucide-react";
import {
  Children,
  type ComponentProps,
  createContext,
  isValidElement,
  type ReactElement,
  type ReactNode,
  use,
  useId,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { Collapsible } from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";
import type { AskUserQuestion } from "@/tools/ask-user";
import { ChevronDownIcon } from "./icons/chevron-down";
import Button from "./ui/button";

// ---------------------------------------------------------------------------
// Contexts
// ---------------------------------------------------------------------------

type AnswerEntry = { selected: Set<string>; freeText: string };

type QuestionnaireContextValue = {
  stepCount: number;
  setStepCount: (count: number) => void;
  stepsMap: Map<number, string>;
  currentStep: number;
  totalSteps: number;
  answers: Map<number, AnswerEntry>;
  toggleOption: (
    stepIndex: number,
    label: string,
    multiSelect: boolean,
  ) => void;
  setFreeText: (stepIndex: number, value: string, multiSelect: boolean) => void;
  goBack: () => void;
  goNext: () => void;
  handleSubmit: () => void;
  isReviewStep: boolean;
  isSingleQuestion: boolean;
  isStepAnswered: (i: number) => boolean;
  hasAllAnswers: boolean;
};

const QuestionnaireContext = createContext<QuestionnaireContextValue | null>(
  null,
);

const useQuestionnaire = () => {
  const ctx = use(QuestionnaireContext);
  if (!ctx)
    throw new Error("useQuestionnaire must be used inside <Questionnaire>");
  return ctx;
};

type StepContextValue = {
  index: number;
  multiSelect: boolean;
  entry: AnswerEntry;
  groupName: string;
  toggle: (label: string) => void;
  setFreeText: (value: string) => void;
};

const StepContext = createContext<StepContextValue | null>(null);

const useStep = () => {
  const ctx = use(StepContext);
  if (!ctx) throw new Error("useStep must be used inside <Questionnaire.Step>");
  return ctx;
};

// Provided by Content to the active Step — position-based index
const StepIndexContext = createContext<number>(-1);

// ---------------------------------------------------------------------------
// Root — state management + context provider
// ---------------------------------------------------------------------------

type QuestionnaireRootProps = Omit<ComponentProps<"div">, "onSubmit"> & {
  onSubmit: (answers: Record<string, string>) => void;
  children: ReactNode;
};

const QuestionnaireRoot = ({
  onSubmit,
  children,
  className,
  ...props
}: QuestionnaireRootProps) => {
  const [stepCount, setStepCount] = useState(0);
  const stepsMap = useRef<Map<number, string>>(new Map());

  const isSingle = stepCount === 1;
  const totalSteps = stepCount <= 1 ? stepCount : stepCount + 1;

  const [currentStep, setCurrentStep] = useState(0);
  const [answers, setAnswers] = useState<Map<number, AnswerEntry>>(
    () => new Map(),
  );

  const isReviewStep = stepCount > 1 && currentStep === stepCount;

  const toggleOption = (
    stepIndex: number,
    label: string,
    multiSelect: boolean,
  ) => {
    setAnswers((prev) => {
      const next = new Map(prev);
      const entry = next.get(stepIndex) ?? {
        selected: new Set(),
        freeText: "",
      };
      const newSelected = new Set(entry.selected);
      if (multiSelect) {
        if (newSelected.has(label)) newSelected.delete(label);
        else newSelected.add(label);
      } else {
        newSelected.clear();
        newSelected.add(label);
      }
      next.set(stepIndex, { selected: newSelected, freeText: "" });
      return next;
    });
  };

  const setFreeText = (
    stepIndex: number,
    value: string,
    multiSelect: boolean,
  ) => {
    setAnswers((prev) => {
      const next = new Map(prev);
      const entry = next.get(stepIndex) ?? {
        selected: new Set(),
        freeText: "",
      };
      next.set(stepIndex, {
        selected: multiSelect ? entry.selected : new Set(),
        freeText: value,
      });
      return next;
    });
  };

  const isStepAnswered = (i: number) => {
    const entry = answers.get(i);
    return (
      !!entry && (entry.selected.size > 0 || entry.freeText.trim().length > 0)
    );
  };

  let hasAllAnswers = stepCount > 0;
  for (let i = 0; i < stepCount; i++) {
    if (!isStepAnswered(i)) {
      hasAllAnswers = false;
      break;
    }
  }

  const handleSubmit = () => {
    if (!hasAllAnswers) return;
    const result: Record<string, string> = {};
    for (const [i, label] of stepsMap.current) {
      const entry = answers.get(i);
      if (!entry) continue;
      result[label] =
        entry.selected.size > 0
          ? [...entry.selected].join(", ")
          : entry.freeText.trim();
    }
    onSubmit(result);
  };

  const goBack = () => {
    setCurrentStep((s) => Math.max(0, s - 1));
  };

  const goNext = () => {
    setCurrentStep((s) => Math.min(totalSteps - 1, s + 1));
  };

  return (
    <QuestionnaireContext
      value={{
        stepCount,
        setStepCount,
        stepsMap: stepsMap.current,
        currentStep,
        totalSteps,
        answers,
        toggleOption,
        setFreeText,
        goBack,
        goNext,
        handleSubmit,
        isReviewStep,
        isSingleQuestion: isSingle,
        isStepAnswered,
        hasAllAnswers,
      }}
    >
      <div className={cn("flex flex-col gap-3 p-3", className)} {...props}>
        {children}
      </div>
    </QuestionnaireContext>
  );
};

// ---------------------------------------------------------------------------
// Content — AnimatePresence container, renders only the active Step or Review
// ---------------------------------------------------------------------------

type QuestionnaireContentProps = ComponentProps<"div">;

const QuestionnaireContent = ({
  children,
  className,
  ...props
}: QuestionnaireContentProps) => {
  const ctx = useQuestionnaire();
  const childArray = Children.toArray(children);

  // Collect Step children — their position determines their index
  const steps: ReactElement[] = [];
  let review: ReactElement | undefined;
  for (const child of childArray) {
    if (isValidElement(child)) {
      if (child.type === QuestionnaireStep) steps.push(child);
      else if (child.type === QuestionnaireReview) review = child;
    }
  }

  // Register step values with Root (read by handleSubmit + Review)
  ctx.stepsMap.clear();
  for (let i = 0; i < steps.length; i++) {
    ctx.stepsMap.set(i, (steps[i].props as { value: string }).value);
  }

  // Register step count with Root (fires before paint)
  const count = steps.length;
  useLayoutEffect(() => {
    ctx.setStepCount(count);
  }, [count, ctx.setStepCount]);

  // Select the active child by position
  const active = ctx.isReviewStep ? review : steps[ctx.currentStep];

  return (
    <div className={className} {...props}>
      <StepIndexContext value={ctx.currentStep}>{active}</StepIndexContext>
    </div>
  );
};

// ---------------------------------------------------------------------------
// Step — wraps one question, renders header from props, provides StepContext
// ---------------------------------------------------------------------------

type QuestionnaireStepProps = ComponentProps<"div"> & {
  value: string;
  multiSelect?: boolean;
};

const QuestionnaireStep = ({
  value,
  multiSelect = false,
  children,
  className,
  ...props
}: QuestionnaireStepProps) => {
  const ctx = useQuestionnaire();
  const index = use(StepIndexContext);
  const groupName = useId();

  const entry = ctx.answers.get(index) ?? {
    selected: new Set<string>(),
    freeText: "",
  };

  return (
    <StepContext
      value={{
        index,
        multiSelect,
        entry,
        groupName,
        toggle: (l) => ctx.toggleOption(index, l, multiSelect),
        setFreeText: (v) => ctx.setFreeText(index, v, multiSelect),
      }}
    >
      <div className={cn("flex flex-col gap-2", className)} {...props}>
        {children}
      </div>
    </StepContext>
  );
};

// ---------------------------------------------------------------------------
// Label — question heading text
// ---------------------------------------------------------------------------

type QuestionnaireLabelProps = ComponentProps<"p">;

const QuestionnaireLabel = ({
  className,
  ...props
}: QuestionnaireLabelProps) => (
  <p
    className={cn("text-sm font-medium leading-tight", className)}
    {...props}
  />
);

// ---------------------------------------------------------------------------
// Options — fieldset wrapper
// ---------------------------------------------------------------------------

type QuestionnaireOptionsProps = ComponentProps<"fieldset">;

const QuestionnaireOptions = ({
  className,
  ...props
}: QuestionnaireOptionsProps) => (
  <fieldset className={cn("flex flex-col gap-1.5", className)} {...props} />
);

// ---------------------------------------------------------------------------
// Option — selectable card (reads from StepContext)
// ---------------------------------------------------------------------------

type QuestionnaireOptionProps = Omit<ComponentProps<"label">, "children"> & {
  value: string;
  description?: string;
};

const QuestionnaireOption = ({
  value,
  description,
  className,
  ...props
}: QuestionnaireOptionProps) => {
  const step = useStep();
  const isSelected = step.entry.selected.has(value);

  return (
    <label
      className={cn(
        "flex cursor-pointer items-start gap-2.5 rounded-lg border px-3 py-2 transition-colors",
        isSelected
          ? "border-slate-7 bg-slate-1"
          : "border-slate-7 bg-slate-2 hover:bg-slate-3",
        className,
      )}
      {...props}
    >
      <input
        type={step.multiSelect ? "checkbox" : "radio"}
        name={step.groupName}
        checked={isSelected}
        onChange={() => step.toggle(value)}
        className="mt-0.5 accent-primary"
      />
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="text-sm leading-tight">{value}</span>
        {description && (
          <span className="text-muted-foreground text-xs leading-snug">
            {description}
          </span>
        )}
      </span>
    </label>
  );
};

// ---------------------------------------------------------------------------
// TextInput — free text (reads from StepContext)
// ---------------------------------------------------------------------------

type QuestionnaireTextInputProps = Omit<
  ComponentProps<"input">,
  "value" | "onChange"
> & {
  hasOptions?: boolean;
};

const QuestionnaireTextInput = ({
  hasOptions,
  className,
  ...props
}: QuestionnaireTextInputProps) => {
  const ctx = useQuestionnaire();
  const step = useStep();

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      if (ctx.isSingleQuestion) {
        ctx.handleSubmit();
      } else if (ctx.currentStep < ctx.totalSteps - 1) {
        ctx.goNext();
      }
    }
  };

  return (
    <input
      type="text"
      value={step.entry.freeText}
      onChange={(e) => step.setFreeText(e.target.value)}
      onKeyDown={handleKeyDown}
      disabled={ctx.isStepAnswered(step.index)}
      placeholder={
        hasOptions ? "Or type your own answer..." : "Type your answer..."
      }
      className={cn(
        "min-w-0 flex-1 rounded-lg border border-slate-7 bg-slate-2 px-3 py-1.5 text-sm outline-none transition-colors placeholder:text-muted-foreground focus:border-primary disabled:pointer-events-none disabled:opacity-60",
        className,
      )}
      {...props}
    />
  );
};

// ---------------------------------------------------------------------------
// Previous / Next / StepLabel — nav (hidden for single question)
// ---------------------------------------------------------------------------

type QuestionnairePreviousProps = ComponentProps<"button">;

const QuestionnairePrevious = ({
  className,
  ...props
}: QuestionnairePreviousProps) => {
  const ctx = useQuestionnaire();
  if (ctx.isSingleQuestion) return null;

  return (
    <button
      type="button"
      onClick={ctx.goBack}
      disabled={ctx.currentStep === 0}
      className={cn(
        "flex size-6 cursor-pointer items-center justify-center rounded-md text-slate-11 transition-colors hover:bg-slate-3 hover:text-slate-12 disabled:pointer-events-none disabled:opacity-30",
        className,
      )}
      {...props}
    >
      <ChevronLeftIcon className="size-3.5" />
    </button>
  );
};

type QuestionnaireNextProps = ComponentProps<"button">;

const QuestionnaireNext = ({ className, ...props }: QuestionnaireNextProps) => {
  const ctx = useQuestionnaire();
  if (ctx.isSingleQuestion) return null;

  return (
    <button
      type="button"
      onClick={ctx.goNext}
      disabled={ctx.currentStep === ctx.totalSteps - 1}
      className={cn(
        "flex size-6 cursor-pointer items-center justify-center rounded-md text-slate-11 transition-colors hover:bg-slate-3 hover:text-slate-12 disabled:pointer-events-none disabled:opacity-30",
        className,
      )}
      {...props}
    >
      <ChevronRightIcon className="size-3.5" />
    </button>
  );
};

type QuestionnaireStepLabelProps = ComponentProps<"span">;

const QuestionnaireStepLabel = ({
  className,
  ...props
}: QuestionnaireStepLabelProps) => {
  const ctx = useQuestionnaire();
  if (ctx.isSingleQuestion) return null;

  return (
    <span
      className={cn("text-2xs tabular-nums text-slate-10", className)}
      {...props}
    >
      {ctx.currentStep + 1} of {ctx.totalSteps}
    </span>
  );
};

// ---------------------------------------------------------------------------
// Review — Q&A summary from registered step labels + answers
// ---------------------------------------------------------------------------

type QuestionnaireReviewProps = ComponentProps<"div">;

const QuestionnaireReview = ({
  children,
  className,
  ...props
}: QuestionnaireReviewProps) => {
  const ctx = useQuestionnaire();

  return (
    <div className={cn("flex flex-col gap-3", className)} {...props}>
      {children ??
        Array.from(ctx.stepsMap.entries()).map(([i, label]) => {
          const entry = ctx.answers.get(i);
          const answer = entry
            ? entry.selected.size > 0
              ? [...entry.selected].join(", ")
              : entry.freeText.trim() || "—"
            : "—";

          return (
            <div key={label} className="flex flex-col gap-0.5">
              <span className="text-xs font-medium leading-tight text-slate-11">
                {label}
              </span>
              <span className="text-sm leading-tight">{answer}</span>
            </div>
          );
        })}
    </div>
  );
};

// ---------------------------------------------------------------------------
// ReviewItem — single Q&A pair (reads answer from root context)
// ---------------------------------------------------------------------------

type QuestionnaireReviewItemProps = ComponentProps<"div"> & {
  index: number;
};

const QuestionnaireReviewItem = ({
  index,
  children,
  className,
  ...props
}: QuestionnaireReviewItemProps) => {
  const ctx = useQuestionnaire();
  const entry = ctx.answers.get(index);
  const answer = entry
    ? entry.selected.size > 0
      ? [...entry.selected].join(", ")
      : entry.freeText.trim() || "—"
    : "—";

  return (
    <div className={cn("flex flex-col gap-0.5", className)} {...props}>
      <span className="text-xs font-medium leading-tight text-slate-11">
        {children}
      </span>
      <span className="text-sm leading-tight">{answer}</span>
    </div>
  );
};

// ---------------------------------------------------------------------------
// Actions — back / continue / submit
// ---------------------------------------------------------------------------

type QuestionnaireActionsProps = ComponentProps<"div">;

const QuestionnaireActions = ({
  className,
  ...props
}: QuestionnaireActionsProps) => {
  const ctx = useQuestionnaire();

  if (ctx.isSingleQuestion) {
    return (
      <div className={cn("flex justify-end", className)} {...props}>
        <Button onClick={ctx.handleSubmit} disabled={!ctx.isStepAnswered(0)}>
          <SendIcon className="size-3.5" />
          Submit
        </Button>
      </div>
    );
  }
};

// ---------------------------------------------------------------------------
// Summary — collapsible read-only view (standalone, for answered tool calls)
// ---------------------------------------------------------------------------

type QuestionnaireSummaryProps = ComponentProps<typeof Collapsible> & {
  questions: AskUserQuestion[];
  answers: Record<string, string>;
};

const QuestionnaireSummary = ({
  questions,
  answers,
  className,
  ...props
}: QuestionnaireSummaryProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const count = questions.length;

  return (
    <Collapsible
      open={isOpen}
      onOpenChange={setIsOpen}
      className={cn("not-prose w-full", className)}
      {...props}
    >
      <Collapsible.Trigger className="flex w-full cursor-pointer items-center gap-2 rounded-md py-1 text-sm text-slate-11 transition-colors hover:text-slate-12">
        <span className="text-gray-11/60">
          Answered {count} {count === 1 ? "question" : "questions"}
        </span>
        <ChevronDownIcon
          className={cn(
            "size-3.5 shrink-0 transition-transform",
            isOpen ? "rotate-180" : "rotate-0",
          )}
        />
      </Collapsible.Trigger>
      <Collapsible.Panel className="mt-2 flex flex-col gap-2">
        {questions.map((q) => (
          <div key={q.question} className="flex gap-2 leading-tight">
            <div className="flex h-lh shrink-0 items-center justify-center">
              <CircleHelpIcon className="size-4" />
            </div>
            <div className="flex flex-col gap-0.5">
              <span className="text-sm font-medium leading-tight">
                {q.question}
              </span>
              <span className="text-sm leading-tight text-slate-11">
                {answers[q.question] ?? "—"}
              </span>
            </div>
          </div>
        ))}
      </Collapsible.Panel>
    </Collapsible>
  );
};

// ---------------------------------------------------------------------------
// Compound export
// ---------------------------------------------------------------------------

export const Questionnaire = Object.assign(QuestionnaireRoot, {
  Content: QuestionnaireContent,
  Step: QuestionnaireStep,
  Label: QuestionnaireLabel,
  Options: QuestionnaireOptions,
  Option: QuestionnaireOption,
  TextInput: QuestionnaireTextInput,
  Previous: QuestionnairePrevious,
  Next: QuestionnaireNext,
  StepLabel: QuestionnaireStepLabel,
  Review: QuestionnaireReview,
  ReviewItem: QuestionnaireReviewItem,
  Actions: QuestionnaireActions,
  Summary: QuestionnaireSummary,
});
