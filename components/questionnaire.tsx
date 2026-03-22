"use client";

import {
  ChevronLeftIcon,
  ChevronRightIcon,
  CircleHelpIcon,
} from "lucide-react";
import {
  type ComponentProps,
  createContext,
  use,
  useId,
  useState,
} from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { Collapsible } from "@/components/ui/collapsible";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { cn } from "@/lib/utils";
import type { AskUserQuestion } from "@/tools/ask-user";
import { ChevronDownIcon } from "./icons/chevron-down";

/** Questionnaire root container. Stateless — consumers manage all state externally. */
type QuestionnaireRootProps = ComponentProps<"div">;

const QuestionnaireRoot = ({ className, ...props }: QuestionnaireRootProps) => (
  <div className={cn("flex flex-col gap-3 p-3", className)} {...props} />
);

/** Question heading text. */
type QuestionnaireLabelProps = ComponentProps<"p">;

const QuestionnaireLabel = ({
  className,
  ...props
}: QuestionnaireLabelProps) => (
  <p
    className={cn(
      "min-w-0 flex-1 text-sm font-medium leading-tight",
      className,
    )}
    {...props}
  />
);

/** Row container for `Label` and optional `Navigation`. */
type QuestionnaireHeaderProps = ComponentProps<"div">;

const QuestionnaireHeader = ({
  className,
  ...props
}: QuestionnaireHeaderProps) => (
  <div className={cn("flex h-6 items-center gap-2", className)} {...props} />
);

/** Row container for `Previous`, `StepLabel`, and `Next`. */
type QuestionnaireNavigationProps = ComponentProps<"div">;

const QuestionnaireNavigation = ({
  className,
  ...props
}: QuestionnaireNavigationProps) => (
  <div
    className={cn("flex items-center gap-1 shrink-0", className)}
    {...props}
  />
);

/** Navigate to the previous step. */
type QuestionnairePreviousProps = ComponentProps<"button">;

const QuestionnairePrevious = ({
  className,
  ...props
}: QuestionnairePreviousProps) => (
  <button
    type="button"
    className={cn(
      "flex size-6 cursor-pointer items-center justify-center rounded-md text-slate-11 transition-colors hover:bg-slate-3 hover:text-slate-12 disabled:pointer-events-none disabled:opacity-30",
      className,
    )}
    {...props}
  >
    <ChevronLeftIcon className="size-3.5" />
  </button>
);

/** Navigate to the next step. */
type QuestionnaireNextProps = ComponentProps<"button">;

const QuestionnaireNext = ({ className, ...props }: QuestionnaireNextProps) => (
  <button
    type="button"
    className={cn(
      "flex size-6 cursor-pointer items-center justify-center rounded-md text-slate-11 transition-colors hover:bg-slate-3 hover:text-slate-12 disabled:pointer-events-none disabled:opacity-30",
      className,
    )}
    {...props}
  >
    <ChevronRightIcon className="size-3.5" />
  </button>
);

/** Displays "{current} of {total}" step indicator. Supports custom children to override the default text. */
type QuestionnaireStepLabelProps = ComponentProps<"span"> & {
  current: number;
  total: number;
};

const QuestionnaireStepLabel = ({
  current,
  total,
  className,
  children,
  ...props
}: QuestionnaireStepLabelProps) => (
  <span
    className={cn("text-2xs tabular-nums text-slate-10", className)}
    {...props}
  >
    {children ?? `${current} of ${total}`}
  </span>
);

/** Fieldset wrapper for `Option` items. Provides `multiSelect` and `groupName` to child `OptionInput` components via context. When `multiSelect` is false, wraps children in a `RadioGroup`. */
type OptionsContextValue = {
  multiSelect: boolean;
  groupName: string;
};

const OptionsContext = createContext<OptionsContextValue>({
  multiSelect: false,
  groupName: "",
});

type QuestionnaireOptionsProps = Omit<ComponentProps<"fieldset">, "value"> & {
  /** When true, `OptionInput` renders as checkboxes. When false (default), renders as radio buttons inside a `RadioGroup`. */
  multiSelect?: boolean;
  /** Shared `name` attribute for all `OptionInput` elements in this group. */
  groupName?: string;
  /** The currently selected value (used as RadioGroup value when not multiSelect). */
  value?: string;
  /** Called when the RadioGroup value changes (single-select mode only). */
  onValueChange?: (value: string) => void;
};

const QuestionnaireOptions = ({
  multiSelect = false,
  groupName = "",
  value,
  onValueChange,
  className,
  children,
  ...props
}: QuestionnaireOptionsProps) => {
  const content = (
    <fieldset className={cn("flex flex-col gap-1.5", className)} {...props}>
      {children}
    </fieldset>
  );

  return (
    <OptionsContext value={{ multiSelect, groupName }}>
      {multiSelect ? (
        content
      ) : (
        <RadioGroup
          value={value ?? ""}
          onValueChange={onValueChange}
          className="gap-0"
        >
          {content}
        </RadioGroup>
      )}
    </OptionsContext>
  );
};

/** Selectable card. Provides `selected`, `onSelect`, and `value` to child `OptionInput` via context. Compose with `OptionInput`, `OptionContent`, `OptionLabel`, and `OptionDescription`. */
type OptionContextValue = {
  id: string;
  value: string;
  selected: boolean;
  onSelect?: () => void;
};

const OptionContext = createContext<OptionContextValue>({
  id: "",
  value: "",
  selected: false,
  onSelect: () => {},
});

type QuestionnaireOptionProps = ComponentProps<"label"> & {
  value?: string;
  selected?: boolean;
  onSelect?: () => void;
};

const QuestionnaireOption = ({
  value = "",
  selected = false,
  onSelect,
  className,
  children,
  ...props
}: QuestionnaireOptionProps) => {
  const id = useId();
  return (
    <OptionContext value={{ id, value, selected, onSelect }}>
      <label
        htmlFor={id}
        className={cn(
          "flex cursor-pointer items-start gap-2.5 bg-slate-1 hover:bg-slate-3 rounded-lg border border-slate-6 px-3 py-2 transition-colors",
          selected && "bg-slate-1",
          className,
        )}
        {...props}
      >
        {children}
      </label>
    </OptionContext>
  );
};

/** Renders a `Checkbox` or native radio based on the parent `Options` `multiSelect` prop. Reads all state from context. */
const QuestionnaireOptionInput = () => {
  const options = use(OptionsContext);
  const option = use(OptionContext);

  return options.multiSelect ? (
    <QuestionnaireOptionCheckbox id={option.id} />
  ) : (
    <QuestionnaireOptionRadio id={option.id} />
  );
};

/** Checkbox input that reads `checked` and `onCheckedChange` from `Option` context. */
const QuestionnaireOptionCheckbox = (
  props: Omit<Parameters<typeof Checkbox>[0], "checked" | "onCheckedChange">,
) => {
  const option = use(OptionContext);
  return (
    <Checkbox
      checked={option.selected}
      onCheckedChange={option.onSelect}
      {...props}
    />
  );
};

/** Radio input using `RadioGroupItem`. Reads `value` from `Option` context. Must be inside an `Options` with `multiSelect={false}`. */
const QuestionnaireOptionRadio = (
  props: Omit<Parameters<typeof RadioGroupItem>[0], "value">,
) => {
  const option = use(OptionContext);
  return <RadioGroupItem value={option.value} {...props} />;
};

/** Flex column wrapper for `OptionLabel` and `OptionDescription`. */
type QuestionnaireOptionContentProps = ComponentProps<"span">;

const QuestionnaireOptionContent = ({
  className,
  ...props
}: QuestionnaireOptionContentProps) => (
  <span className={cn("flex min-w-0 flex-1 flex-col", className)} {...props} />
);

/** Option title text. */
type QuestionnaireOptionLabelProps = ComponentProps<"span">;

const QuestionnaireOptionLabel = ({
  className,
  ...props
}: QuestionnaireOptionLabelProps) => (
  <span className={cn("text-sm leading-tight", className)} {...props} />
);

/** Option subtitle/description text. */
type QuestionnaireOptionDescriptionProps = ComponentProps<"span">;

const QuestionnaireOptionDescription = ({
  className,
  ...props
}: QuestionnaireOptionDescriptionProps) => (
  <span
    className={cn("text-slate-11 text-xs leading-tight", className)}
    {...props}
  />
);

/** Collapsible read-only summary of answered questions. Used for completed tool calls. */
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

export const Questionnaire = Object.assign(QuestionnaireRoot, {
  Header: QuestionnaireHeader,
  Label: QuestionnaireLabel,
  Navigation: QuestionnaireNavigation,
  Previous: QuestionnairePrevious,
  Next: QuestionnaireNext,
  StepLabel: QuestionnaireStepLabel,
  Options: QuestionnaireOptions,
  Option: QuestionnaireOption,
  OptionInput: QuestionnaireOptionInput,
  OptionCheckbox: QuestionnaireOptionCheckbox,
  OptionRadio: QuestionnaireOptionRadio,
  OptionContent: QuestionnaireOptionContent,
  OptionLabel: QuestionnaireOptionLabel,
  OptionDescription: QuestionnaireOptionDescription,
  Summary: QuestionnaireSummary,
});
