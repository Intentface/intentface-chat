"use client";

import {
  type AskUserOptionsHandle,
  AskUser as AskUserPrimitive,
  useAskUserOption,
  useAskUserOptions,
} from "@intentface/chat/ask-user";
import { CheckIcon, ChevronLeftIcon, ChevronRightIcon, CircleHelpIcon } from "lucide-react";
import { type ComponentProps, type RefObject, useState } from "react";
import { ChevronDownIcon } from "@/components/icons/chevron-down";
import { Collapsible } from "@/components/ui/collapsible";
import type { AskUserQuestion } from "@/lib/ai/types";
import { cn } from "@/lib/utils";

export type { AskUserOptionsHandle };

/** AskUser root container. Stateless — consumers manage all state externally. */
type AskUserRootProps = ComponentProps<typeof AskUserPrimitive>;

const AskUserRoot = ({ className, ...props }: AskUserRootProps) => (
  <AskUserPrimitive className={cn("flex flex-col gap-2 p-2", className)} {...props} />
);

/** Question heading text. */
type AskUserLabelProps = ComponentProps<typeof AskUserPrimitive.Label>;

const AskUserLabel = ({ className, ...props }: AskUserLabelProps) => (
  <AskUserPrimitive.Label
    className={cn("min-w-0 flex-1 px-2 text-sm font-medium leading-tight", className)}
    {...props}
  />
);

/** Row container for `Label` and optional `Navigation`. */
type AskUserHeaderProps = ComponentProps<typeof AskUserPrimitive.Header>;

const AskUserHeader = ({ className, ...props }: AskUserHeaderProps) => (
  <AskUserPrimitive.Header className={cn("flex h-7 items-center gap-2", className)} {...props} />
);

/** Row container for `Previous`, `StepLabel`, and `Next`. */
type AskUserNavigationProps = ComponentProps<typeof AskUserPrimitive.Navigation>;

const AskUserNavigation = ({ className, ...props }: AskUserNavigationProps) => (
  <AskUserPrimitive.Navigation
    className={cn("flex items-center gap-1 shrink-0", className)}
    {...props}
  />
);

const navigationButtonClasses =
  "flex size-6 cursor-pointer items-center justify-center rounded-md text-ink-secondary transition-colors hover:bg-tertiary-hover hover:text-ink-primary disabled:pointer-events-none disabled:opacity-30";

/** Navigate to the previous step. */
type AskUserPreviousProps = ComponentProps<typeof AskUserPrimitive.Previous>;

const AskUserPrevious = ({ className, ...props }: AskUserPreviousProps) => (
  <AskUserPrimitive.Previous className={cn(navigationButtonClasses, className)} {...props}>
    <ChevronLeftIcon className="size-3.5" />
  </AskUserPrimitive.Previous>
);

/** Navigate to the next step. */
type AskUserNextProps = ComponentProps<typeof AskUserPrimitive.Next>;

const AskUserNext = ({ className, ...props }: AskUserNextProps) => (
  <AskUserPrimitive.Next className={cn(navigationButtonClasses, className)} {...props}>
    <ChevronRightIcon className="size-3.5" />
  </AskUserPrimitive.Next>
);

/** Displays "{current} of {total}" step indicator. Supports custom children to override the default text. */
type AskUserStepLabelProps = ComponentProps<typeof AskUserPrimitive.StepLabel>;

const AskUserStepLabel = ({ className, ...props }: AskUserStepLabelProps) => (
  <AskUserPrimitive.StepLabel
    className={cn("text-2xs tabular-nums text-ink-tertiary", className)}
    {...props}
  />
);

/** Fieldset wrapper for `Option` items. The primitive owns the radiogroup/group
 * semantics and roving focus; selection flows through Option selected/onSelect. */
type AskUserOptionsProps = ComponentProps<typeof AskUserPrimitive.Options> & {
  ref?: RefObject<AskUserOptionsHandle | null>;
};

const AskUserOptions = ({ multiSelect = false, className, ...props }: AskUserOptionsProps) => (
  <AskUserPrimitive.Options
    multiSelect={multiSelect}
    className={cn("flex flex-col gap-1.5", className)}
    {...props}
  />
);

/** Selectable card. Self-registers with parent `Options` on mount (cmdk pattern). */
type AskUserOptionProps = ComponentProps<typeof AskUserPrimitive.Option>;

const AskUserOption = ({ className, ...props }: AskUserOptionProps) => (
  <AskUserPrimitive.Option
    className={cn(
      "flex cursor-pointer items-start gap-2 rounded-lg p-2 leading-tight transition-colors",
      "data-highlighted:bg-primary-hover",
      className,
    )}
    {...props}
  />
);

/** Decorative selection indicator. The Option element itself carries the
 * radio/checkbox role and checked state, so this is pure presentation —
 * aria-hidden, no id, never focusable (a nested control would be invalid
 * inside role=radio and would break the composer's key scoping). */
const AskUserOptionInput = () => {
  const options = useAskUserOptions();
  return options.multiSelect ? <AskUserOptionCheckIndicator /> : <AskUserOptionIndexIndicator />;
};

const INDICATOR_CLASS = cn(
  "flex size-lh shrink-0 items-center justify-center rounded-[4px] border border-tertiary-border bg-tertiary text-2xs font-medium tabular-nums text-ink-secondary",
);

const INDICATOR_SELECTED_CLASS = "border-tertiary-active bg-tertiary-active text-ink-primary";

const AskUserOptionCheckIndicator = () => {
  const option = useAskUserOption();
  return (
    <span
      aria-hidden="true"
      className={cn(INDICATOR_CLASS, option.selected && INDICATOR_SELECTED_CLASS)}
    >
      {option.selected && <CheckIcon className="size-3" />}
    </span>
  );
};

/** Numbered indicator for single-select options: the item's 1-based index. */
const AskUserOptionIndexIndicator = () => {
  const option = useAskUserOption();
  const { items } = useAskUserOptions();
  const index = items.current.indexOf(option.value) + 1;
  return (
    <span
      aria-hidden="true"
      className={cn(INDICATOR_CLASS, option.selected && INDICATOR_SELECTED_CLASS)}
    >
      {index}
    </span>
  );
};

/** Flex column wrapper for `OptionLabel` and `OptionDescription`. */
type AskUserOptionContentProps = ComponentProps<typeof AskUserPrimitive.OptionContent>;

const AskUserOptionContent = ({ className, ...props }: AskUserOptionContentProps) => (
  <AskUserPrimitive.OptionContent
    className={cn("flex min-w-0 flex-1 gap-1 flex-col", className)}
    {...props}
  />
);

/** Option title text. */
type AskUserOptionLabelProps = ComponentProps<typeof AskUserPrimitive.OptionLabel>;

const AskUserOptionLabel = ({ className, ...props }: AskUserOptionLabelProps) => (
  <AskUserPrimitive.OptionLabel className={cn("text-sm leading-tight", className)} {...props} />
);

/** Option subtitle/description text. */
type AskUserOptionDescriptionProps = ComponentProps<typeof AskUserPrimitive.OptionDescription>;

const AskUserOptionDescription = ({ className, ...props }: AskUserOptionDescriptionProps) => (
  <AskUserPrimitive.OptionDescription
    className={cn("text-ink-secondary text-xs leading-tight", className)}
    {...props}
  />
);

/** Collapsible read-only summary of answered questions. Used for completed tool calls. */
type AskUserSummaryProps = ComponentProps<typeof Collapsible> & {
  questions: AskUserQuestion[];
  answers: Record<string, string>;
};

const AskUserSummary = ({ questions, answers, className, ...props }: AskUserSummaryProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const count = questions.length;

  return (
    <Collapsible
      open={isOpen}
      onOpenChange={setIsOpen}
      className={cn("not-prose w-full", className)}
      {...props}
    >
      <Collapsible.Trigger className="flex w-full cursor-pointer items-center gap-2 rounded-md py-1 text-sm text-ink-secondary transition-colors hover:text-ink-primary">
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
              <span className="text-sm font-medium leading-tight">{q.question}</span>
              <span className="text-sm leading-tight text-ink-secondary">
                {answers[q.question] ?? "—"}
              </span>
            </div>
          </div>
        ))}
      </Collapsible.Panel>
    </Collapsible>
  );
};

/** Keyboard shortcut hints displayed below the ask-user options. */
type AskUserHintsProps = ComponentProps<typeof AskUserPrimitive.Hints>;

const AskUserHints = ({ className, ...props }: AskUserHintsProps) => (
  <AskUserPrimitive.Hints
    className={cn("flex items-center gap-3 px-2 pt-1 text-2xs text-ink-tertiary", className)}
    {...props}
  />
);

export const AskUser = Object.assign(AskUserRoot, {
  Header: AskUserHeader,
  Label: AskUserLabel,
  Navigation: AskUserNavigation,
  Previous: AskUserPrevious,
  Next: AskUserNext,
  StepLabel: AskUserStepLabel,
  Options: AskUserOptions,
  Option: AskUserOption,
  OptionInput: AskUserOptionInput,
  OptionContent: AskUserOptionContent,
  OptionLabel: AskUserOptionLabel,
  OptionDescription: AskUserOptionDescription,
  Summary: AskUserSummary,
  Hints: AskUserHints,
});
