"use client";

import {
  type AskOptionsHandle,
  Ask as AskPrimitive,
  useAskOption,
  useAskOptions,
} from "@intentface/chat/ask";
import { CheckIcon } from "lucide-react";
import type { ComponentProps, RefObject } from "react";
import { ChevronLeftMediumIcon } from "@/components/icons/chevron-left-medium";
import { ChevronRightMediumIcon } from "@/components/icons/chevron-right-medium";
import { cn } from "@/lib/utils";

export type { AskOptionsHandle };

/** Ask root container. Stateless — consumers manage all state externally. */
type AskRootProps = ComponentProps<typeof AskPrimitive.Root>;

const AskRoot = ({ className, ...props }: AskRootProps) => (
  <AskPrimitive.Root className={cn("flex flex-col gap-2 p-2", className)} {...props} />
);

/** Request label text. */
type AskLabelProps = ComponentProps<typeof AskPrimitive.Label>;

const AskLabel = ({ className, ...props }: AskLabelProps) => (
  <AskPrimitive.Label
    className={cn("min-w-0 flex-1 px-2 text-sm font-medium leading-tight", className)}
    {...props}
  />
);

/** Row container for `Label` and optional `Navigation`. */
type AskHeaderProps = ComponentProps<typeof AskPrimitive.Header>;

const AskHeader = ({ className, ...props }: AskHeaderProps) => (
  <AskPrimitive.Header className={cn("flex h-7 items-center gap-2", className)} {...props} />
);

/** Row container for `Previous`, `StepLabel`, and `Next`. */
type AskNavigationProps = ComponentProps<typeof AskPrimitive.Navigation>;

const AskNavigation = ({ className, ...props }: AskNavigationProps) => (
  <AskPrimitive.Navigation
    className={cn("flex items-center gap-1 shrink-0", className)}
    {...props}
  />
);

const navigationButtonClasses =
  "flex size-6 cursor-pointer items-center justify-center rounded-md text-ink-secondary transition-colors hover:bg-tertiary-bg-hover hover:text-ink-primary disabled:pointer-events-none disabled:opacity-30";

/** Navigate to the previous step. */
type AskPreviousProps = ComponentProps<typeof AskPrimitive.Previous>;

const AskPrevious = ({ className, ...props }: AskPreviousProps) => (
  <AskPrimitive.Previous className={cn(navigationButtonClasses, className)} {...props}>
    <ChevronLeftMediumIcon className="size-3.5" />
  </AskPrimitive.Previous>
);

/** Navigate to the next step. */
type AskNextProps = ComponentProps<typeof AskPrimitive.Next>;

const AskNext = ({ className, ...props }: AskNextProps) => (
  <AskPrimitive.Next className={cn(navigationButtonClasses, className)} {...props}>
    <ChevronRightMediumIcon className="size-3.5" />
  </AskPrimitive.Next>
);

/** Displays "{current} of {total}" step indicator. Supports custom children to override the default text. */
type AskStepLabelProps = ComponentProps<typeof AskPrimitive.StepLabel>;

const AskStepLabel = ({ className, ...props }: AskStepLabelProps) => (
  <AskPrimitive.StepLabel
    className={cn("text-2xs tabular-nums text-ink-tertiary", className)}
    {...props}
  />
);

/** Fieldset wrapper for `Option` items. The primitive owns the radiogroup/group
 * semantics and roving focus; selection flows through Option selected/onSelect. */
type AskOptionsProps = ComponentProps<typeof AskPrimitive.Options> & {
  ref?: RefObject<AskOptionsHandle | null>;
};

const AskOptions = ({ multiSelect = false, className, ...props }: AskOptionsProps) => (
  <AskPrimitive.Options
    multiSelect={multiSelect}
    className={cn("flex flex-col gap-1.5", className)}
    {...props}
  />
);

/** Selectable card. Self-registers with parent `Options` on mount (cmdk pattern). */
type AskOptionProps = ComponentProps<typeof AskPrimitive.Option>;

const AskOption = ({ className, ...props }: AskOptionProps) => (
  <AskPrimitive.Option
    className={cn(
      "flex cursor-pointer items-start gap-2 rounded-lg p-2 leading-tight transition-colors",
      "data-highlighted:bg-primary-bg-hover",
      // Options carry real focus (roving tabindex), but focus always tracks
      // the highlight — the bg-primary-bg-hover highlight IS the focus
      // indication, same as command items. No extra ring.
      "outline-none",
      className,
    )}
    {...props}
  />
);

/** Decorative selection indicator. The Option element itself carries the
 * radio/checkbox role and checked state, so this is pure presentation —
 * aria-hidden, no id, never focusable (a nested control would be invalid
 * inside role=radio and would break the composer's key scoping). */
const AskOptionInput = () => {
  const options = useAskOptions();
  return options.multiSelect ? <AskOptionCheckIndicator /> : <AskOptionIndexIndicator />;
};

const INDICATOR_CLASS = cn(
  "flex size-4 shrink-0 items-center justify-center rounded-[4px] border border-tertiary-border bg-tertiary-bg text-2xs font-medium tabular-nums text-ink-secondary",
);

const INDICATOR_SELECTED_CLASS =
  "border-tertiary-border-active bg-tertiary-bg-active text-ink-primary";

const AskOptionCheckIndicator = () => {
  const option = useAskOption();
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
const AskOptionIndexIndicator = () => {
  const option = useAskOption();
  const { items } = useAskOptions();
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
type AskOptionContentProps = ComponentProps<typeof AskPrimitive.OptionContent>;

const AskOptionContent = ({ className, ...props }: AskOptionContentProps) => (
  <AskPrimitive.OptionContent
    className={cn("flex min-w-0 flex-1 gap-1 flex-col", className)}
    {...props}
  />
);

/** Option title text. */
type AskOptionLabelProps = ComponentProps<typeof AskPrimitive.OptionLabel>;

const AskOptionLabel = ({ className, ...props }: AskOptionLabelProps) => (
  <AskPrimitive.OptionLabel className={cn("text-sm leading-tight", className)} {...props} />
);

/** Option subtitle/description text. */
type AskOptionDescriptionProps = ComponentProps<typeof AskPrimitive.OptionDescription>;

const AskOptionDescription = ({ className, ...props }: AskOptionDescriptionProps) => (
  <AskPrimitive.OptionDescription
    className={cn("text-ink-secondary text-xs leading-tight", className)}
    {...props}
  />
);

/** Keyboard shortcut hints displayed below the ask options. */
type AskHintsProps = ComponentProps<typeof AskPrimitive.Hints>;

const AskHints = ({ className, ...props }: AskHintsProps) => (
  <AskPrimitive.Hints
    className={cn("flex items-center gap-3 px-2 pt-1 text-2xs text-ink-tertiary", className)}
    {...props}
  />
);

export const Ask = Object.assign(AskRoot, {
  Header: AskHeader,
  Label: AskLabel,
  Navigation: AskNavigation,
  Previous: AskPrevious,
  Next: AskNext,
  StepLabel: AskStepLabel,
  Options: AskOptions,
  Option: AskOption,
  OptionInput: AskOptionInput,
  OptionContent: AskOptionContent,
  OptionLabel: AskOptionLabel,
  OptionDescription: AskOptionDescription,
  Hints: AskHints,
});
