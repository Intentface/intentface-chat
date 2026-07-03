"use client";

import { ChevronLeftIcon, ChevronRightIcon, CircleHelpIcon } from "lucide-react";
import {
  type ComponentProps,
  createContext,
  type RefObject,
  use,
  useCallback,
  useId,
  useImperativeHandle,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { ChevronDownIcon } from "@/components/icons/chevron-down";
import { Checkbox } from "@/components/ui/checkbox";
import { Collapsible } from "@/components/ui/collapsible";
import { RadioGroup } from "@/components/ui/radio-group";
import type { AskUserQuestion } from "@/lib/ai/types";
import { cn } from "@/lib/utils";

/** AskUser root container. Stateless — consumers manage all state externally. */
type AskUserRootProps = ComponentProps<"div">;

const AskUserRoot = ({ className, ...props }: AskUserRootProps) => (
  <div className={cn("flex flex-col gap-2 p-2", className)} {...props} />
);

/** Question heading text. */
type AskUserLabelProps = ComponentProps<"p">;

const AskUserLabel = ({ className, ...props }: AskUserLabelProps) => (
  <p
    className={cn("min-w-0 flex-1 px-2 text-sm font-medium leading-tight", className)}
    {...props}
  />
);

/** Row container for `Label` and optional `Navigation`. */
type AskUserHeaderProps = ComponentProps<"div">;

const AskUserHeader = ({ className, ...props }: AskUserHeaderProps) => (
  <div className={cn("flex h-7 items-center gap-2", className)} {...props} />
);

/** Row container for `Previous`, `StepLabel`, and `Next`. */
type AskUserNavigationProps = ComponentProps<"div">;

const AskUserNavigation = ({ className, ...props }: AskUserNavigationProps) => (
  <div className={cn("flex items-center gap-1 shrink-0", className)} {...props} />
);

/** Navigate to the previous step. */
type AskUserPreviousProps = ComponentProps<"button">;

const AskUserPrevious = ({ className, ...props }: AskUserPreviousProps) => (
  <button
    type="button"
    className={cn(
      "flex size-6 cursor-pointer items-center justify-center rounded-md text-ink-secondary transition-colors hover:bg-tertiary-hover hover:text-ink-primary disabled:pointer-events-none disabled:opacity-30",
      className,
    )}
    {...props}
  >
    <ChevronLeftIcon className="size-3.5" />
  </button>
);

/** Navigate to the next step. */
type AskUserNextProps = ComponentProps<"button">;

const AskUserNext = ({ className, ...props }: AskUserNextProps) => (
  <button
    type="button"
    className={cn(
      "flex size-6 cursor-pointer items-center justify-center rounded-md text-ink-secondary transition-colors hover:bg-tertiary-hover hover:text-ink-primary disabled:pointer-events-none disabled:opacity-30",
      className,
    )}
    {...props}
  >
    <ChevronRightIcon className="size-3.5" />
  </button>
);

/** Displays "{current} of {total}" step indicator. Supports custom children to override the default text. */
type AskUserStepLabelProps = ComponentProps<"span"> & {
  current: number;
  total: number;
};

const AskUserStepLabel = ({
  current,
  total,
  className,
  children,
  ...props
}: AskUserStepLabelProps) => (
  <span className={cn("text-2xs tabular-nums text-ink-tertiary", className)} {...props}>
    {children ?? `${current} of ${total}`}
  </span>
);

/** Fieldset wrapper for `Option` items. Provides `multiSelect`, `groupName`, and highlight state to child `OptionInput` components via context. Items self-register on mount (cmdk pattern). When `multiSelect` is false, wraps children in a `RadioGroup`. */
type OptionsContextValue = {
  multiSelect: boolean;
  groupName: string;
  highlightedValue: string | null;
  items: RefObject<string[]>;
  register: (value: string) => () => void;
  onItemHover: (value: string) => void;
};

const OptionsContext = createContext<OptionsContextValue>({
  multiSelect: false,
  groupName: "",
  highlightedValue: null,
  items: { current: [] },
  register: () => () => {},
  onItemHover: () => {},
});

/** Imperative handle exposed by `AskUserOptions` for keyboard navigation. */
export type AskUserOptionsHandle = {
  /** Move highlight by direction. Returns the new highlighted value (null = past the list boundary). */
  navigate: (direction: number) => string | null;
  select: () => { value: string } | null;
  clearHighlight: () => void;
  resetHighlight: () => void;
  highlightedValue: string | null;
};

type AskUserOptionsProps = Omit<ComponentProps<"fieldset">, "value" | "ref"> & {
  /** When true, `OptionInput` renders as checkboxes. When false (default), renders as radio buttons inside a `RadioGroup`. */
  multiSelect?: boolean;
  /** Shared `name` attribute for all `OptionInput` elements in this group. */
  groupName?: string;
  /** The currently selected value (used as RadioGroup value when not multiSelect). */
  value?: string;
  /** Called when the RadioGroup value changes (single-select mode only). */
  onValueChange?: (value: string) => void;
  /** Imperative ref for keyboard navigation (navigate, select, clearHighlight, resetHighlight). */
  ref?: RefObject<AskUserOptionsHandle | null>;
};

const AskUserOptions = ({
  multiSelect = false,
  groupName = "",
  value,
  onValueChange,
  ref,
  className,
  children,
  ...props
}: AskUserOptionsProps) => {
  const registeredItems = useRef<string[]>([]);
  const [highlightedValue, setHighlightedValue] = useState<string | null>(null);

  // Track highlight in a ref so imperative methods see latest value without re-binding
  const highlightedValueRef = useRef(highlightedValue);
  highlightedValueRef.current = highlightedValue;

  const register = useCallback((itemValue: string) => {
    registeredItems.current = [...registeredItems.current, itemValue];
    // Auto-highlight whenever an item registers while nothing is highlighted.
    // Using length === 1 here is fragile: during a step transition, React can
    // interleave old-item cleanups with new-item setups, so the new first
    // option may arrive when the list is not exactly length 1.
    if (highlightedValueRef.current === null) {
      highlightedValueRef.current = itemValue;
      setHighlightedValue(itemValue);
    }
    return () => {
      registeredItems.current = registeredItems.current.filter((v) => v !== itemValue);
      // Clear highlight when the highlighted item deregisters — allows auto-highlight
      // to fire for the next set of items (e.g. on step change)
      if (highlightedValueRef.current === itemValue) {
        highlightedValueRef.current = null;
        setHighlightedValue(null);
      }
    };
  }, []);

  const onItemHover = useCallback((itemValue: string) => {
    setHighlightedValue(itemValue);
  }, []);

  useImperativeHandle(
    ref,
    () => ({
      navigate: (direction: number): string | null => {
        const items = registeredItems.current;
        if (items.length === 0) return null;
        const previous = highlightedValueRef.current;
        let next: string | null;
        if (previous === null) {
          next = direction > 0 ? items[0] : items[items.length - 1];
        } else {
          const currentIndex = items.indexOf(previous);
          const nextIndex = currentIndex + direction;
          if (nextIndex >= items.length || nextIndex < 0) next = null;
          else next = items[nextIndex];
        }
        highlightedValueRef.current = next;
        setHighlightedValue(next);
        return next;
      },
      select: () => {
        const current = highlightedValueRef.current;
        if (current === null) return null;
        return { value: current };
      },
      clearHighlight: () => {
        highlightedValueRef.current = null;
        setHighlightedValue(null);
      },
      resetHighlight: () => {
        // Clear synchronously — the auto-highlight path in `register` will pick
        // up the first new item when it mounts after a step change.
        highlightedValueRef.current = null;
        setHighlightedValue(null);
      },
      get highlightedValue() {
        return highlightedValueRef.current;
      },
    }),
    [],
  );

  const content = (
    <fieldset className={cn("flex flex-col gap-1.5", className)} {...props}>
      {children}
    </fieldset>
  );

  return (
    <OptionsContext
      value={{
        multiSelect,
        groupName,
        highlightedValue,
        items: registeredItems,
        register,
        onItemHover,
      }}
    >
      {multiSelect ? (
        content
      ) : (
        <RadioGroup value={value} onValueChange={onValueChange} className="gap-0">
          {content}
        </RadioGroup>
      )}
    </OptionsContext>
  );
};

/** Selectable card. Self-registers with parent `Options` on mount (cmdk pattern). Derives highlight state from context. Compose with `OptionInput`, `OptionContent`, `OptionLabel`, and `OptionDescription`. */
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

type AskUserOptionProps = ComponentProps<"label"> & {
  value?: string;
  selected?: boolean;
  onSelect?: () => void;
};

const AskUserOption = ({
  value = "",
  selected = false,
  onSelect,
  className,
  children,
  ...props
}: AskUserOptionProps) => {
  const id = useId();
  const { highlightedValue, register, onItemHover } = use(OptionsContext);
  const isHighlighted = value === highlightedValue;

  // Self-register on mount, deregister on unmount (true subscription side effect)
  const registerRef = useRef(register);
  registerRef.current = register;
  useItemRegistration(value, registerRef);

  return (
    <OptionContext value={{ id, value, selected, onSelect }}>
      <label
        htmlFor={id}
        data-highlighted={isHighlighted || undefined}
        onMouseMove={() => onItemHover(value)}
        className={cn(
          "flex cursor-pointer items-start gap-2 rounded-lg p-2 transition-colors",
          "data-highlighted:bg-primary-hover",
          className,
        )}
        {...props}
      >
        {children}
      </label>
    </OptionContext>
  );
};

/** Registers an item value with the parent Options container synchronously before paint and deregisters on unmount. */
const useItemRegistration = (
  value: string,
  registerRef: RefObject<(value: string) => () => void>,
) => {
  // useLayoutEffect ensures items are registered before paint so the initial highlight resolves immediately
  // biome-ignore lint/correctness/useExhaustiveDependencies: register is ref-stable
  useLayoutEffect(() => {
    return registerRef.current(value);
  }, [value]);
};

/** Renders a `Checkbox` or native radio based on the parent `Options` `multiSelect` prop. Reads all state from context. */
const AskUserOptionInput = () => {
  const options = use(OptionsContext);
  const option = use(OptionContext);

  return options.multiSelect ? (
    <AskUserOptionCheckbox id={option.id} />
  ) : (
    <AskUserOptionRadio id={option.id} />
  );
};

/** Checkbox input that reads `checked` and `onCheckedChange` from `Option` context. */
const AskUserOptionCheckbox = (
  props: Omit<Parameters<typeof Checkbox>[0], "checked" | "onCheckedChange">,
) => {
  const option = use(OptionContext);
  return <Checkbox checked={option.selected} onCheckedChange={option.onSelect} {...props} />;
};

/** Numbered radio indicator for single-select options. Shows the item's 1-based index instead of a dot. */
const AskUserOptionRadio = ({
  className,
  ...props
}: Omit<Parameters<typeof RadioGroup.Item>[0], "value" | "children">) => {
  const option = use(OptionContext);
  const { items } = use(OptionsContext);
  const index = items.current.indexOf(option.value) + 1;

  return (
    <RadioGroup.Item
      value={option.value}
      className={cn(
        "size-4 rounded-[4px] border border-tertiary-border bg-tertiary text-2xs font-medium tabular-nums text-ink-secondary",
        "data-checked:bg-tertiary-active data-checked:border-tertiary-active data-checked:text-ink-primary",
        className,
      )}
      {...props}
    >
      {index}
    </RadioGroup.Item>
  );
};

/** Flex column wrapper for `OptionLabel` and `OptionDescription`. */
type AskUserOptionContentProps = ComponentProps<"span">;

const AskUserOptionContent = ({ className, ...props }: AskUserOptionContentProps) => (
  <span className={cn("flex min-w-0 flex-1 gap-1 flex-col", className)} {...props} />
);

/** Option title text. */
type AskUserOptionLabelProps = ComponentProps<"span">;

const AskUserOptionLabel = ({ className, ...props }: AskUserOptionLabelProps) => (
  <span className={cn("text-sm leading-[normal]", className)} {...props} />
);

/** Option subtitle/description text. */
type AskUserOptionDescriptionProps = ComponentProps<"span">;

const AskUserOptionDescription = ({ className, ...props }: AskUserOptionDescriptionProps) => (
  <span className={cn("text-ink-secondary text-xs leading-tight", className)} {...props} />
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
type AskUserHintsProps = ComponentProps<"div">;

const AskUserHints = ({ className, ...props }: AskUserHintsProps) => (
  <div
    data-slot="ask-user-hints"
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
  OptionCheckbox: AskUserOptionCheckbox,
  OptionRadio: AskUserOptionRadio,
  OptionContent: AskUserOptionContent,
  OptionLabel: AskUserOptionLabel,
  OptionDescription: AskUserOptionDescription,
  Summary: AskUserSummary,
  Hints: AskUserHints,
});
