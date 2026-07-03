"use client";

// Headless ask-user questionnaire parts. Owns the option registration system
// (cmdk pattern), highlight state, and the imperative keyboard-navigation
// handle. Input widgets (checkbox/radio), icons, and the answered summary
// belong to the styled layer, which reads state via useAskUserOptions() /
// useAskUserOption().

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

/** AskUser root container. Stateless — consumers manage all state externally. */
export type AskUserRootProps = ComponentProps<"div">;

const AskUserRoot = (props: AskUserRootProps) => <div data-slot="ask-user" {...props} />;

/** Question heading text. */
export type AskUserLabelProps = ComponentProps<"p">;

const AskUserLabel = (props: AskUserLabelProps) => <p data-slot="ask-user-label" {...props} />;

/** Row container for `Label` and optional `Navigation`. */
export type AskUserHeaderProps = ComponentProps<"div">;

const AskUserHeader = (props: AskUserHeaderProps) => <div data-slot="ask-user-header" {...props} />;

/** Row container for `Previous`, `StepLabel`, and `Next`. */
export type AskUserNavigationProps = ComponentProps<"div">;

const AskUserNavigation = (props: AskUserNavigationProps) => (
  <div data-slot="ask-user-navigation" {...props} />
);

/** Navigate to the previous step. */
export type AskUserPreviousProps = ComponentProps<"button">;

const AskUserPrevious = (props: AskUserPreviousProps) => (
  <button type="button" data-slot="ask-user-previous" {...props} />
);

/** Navigate to the next step. */
export type AskUserNextProps = ComponentProps<"button">;

const AskUserNext = (props: AskUserNextProps) => (
  <button type="button" data-slot="ask-user-next" {...props} />
);

/** Displays "{current} of {total}" step indicator. Supports custom children to override the default text. */
export type AskUserStepLabelProps = ComponentProps<"span"> & {
  current: number;
  total: number;
};

const AskUserStepLabel = ({ current, total, children, ...props }: AskUserStepLabelProps) => (
  <span data-slot="ask-user-step-label" {...props}>
    {children ?? `${current} of ${total}`}
  </span>
);

/** Fieldset wrapper for `Option` items. Provides `multiSelect`, `groupName`, and highlight state to child options via context. Items self-register on mount (cmdk pattern). */
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

export const useAskUserOptions = () => use(OptionsContext);

/** Imperative handle exposed by `AskUser.Options` for keyboard navigation. */
export type AskUserOptionsHandle = {
  /** Move highlight by direction. Returns the new highlighted value (null = past the list boundary). */
  navigate: (direction: number) => string | null;
  select: () => { value: string } | null;
  clearHighlight: () => void;
  resetHighlight: () => void;
  highlightedValue: string | null;
};

export type AskUserOptionsProps = Omit<ComponentProps<"fieldset">, "value" | "ref"> & {
  /** When true, options render as multi-select (checkbox semantics in the styled layer). */
  multiSelect?: boolean;
  /** Shared `name` attribute for all option inputs in this group. */
  groupName?: string;
  /** Imperative ref for keyboard navigation (navigate, select, clearHighlight, resetHighlight). */
  ref?: RefObject<AskUserOptionsHandle | null>;
};

const AskUserOptions = ({
  multiSelect = false,
  groupName = "",
  ref,
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
          next = (direction > 0 ? items[0] : items[items.length - 1]) ?? null;
        } else {
          const currentIndex = items.indexOf(previous);
          const nextIndex = currentIndex + direction;
          if (nextIndex >= items.length || nextIndex < 0) next = null;
          else next = items[nextIndex] ?? null;
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
      <fieldset data-slot="ask-user-options" {...props}>
        {children}
      </fieldset>
    </OptionsContext>
  );
};

/** Selectable card. Self-registers with parent `Options` on mount (cmdk pattern). Derives highlight state from context. */
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

export const useAskUserOption = () => use(OptionContext);

export type AskUserOptionProps = ComponentProps<"label"> & {
  value?: string;
  selected?: boolean;
  onSelect?: () => void;
};

const AskUserOption = ({
  value = "",
  selected = false,
  onSelect,
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
        data-slot="ask-user-option"
        data-highlighted={isHighlighted || undefined}
        onMouseMove={() => onItemHover(value)}
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
  useLayoutEffect(() => {
    return registerRef.current(value);
  }, [value, registerRef]);
};

/** Flex column wrapper for `OptionLabel` and `OptionDescription`. */
export type AskUserOptionContentProps = ComponentProps<"span">;

const AskUserOptionContent = (props: AskUserOptionContentProps) => (
  <span data-slot="ask-user-option-content" {...props} />
);

/** Option title text. */
export type AskUserOptionLabelProps = ComponentProps<"span">;

const AskUserOptionLabel = (props: AskUserOptionLabelProps) => (
  <span data-slot="ask-user-option-label" {...props} />
);

/** Option subtitle/description text. */
export type AskUserOptionDescriptionProps = ComponentProps<"span">;

const AskUserOptionDescription = (props: AskUserOptionDescriptionProps) => (
  <span data-slot="ask-user-option-description" {...props} />
);

/** Keyboard shortcut hints displayed below the ask-user options. */
export type AskUserHintsProps = ComponentProps<"div">;

const AskUserHints = (props: AskUserHintsProps) => <div data-slot="ask-user-hints" {...props} />;

export const AskUser = Object.assign(AskUserRoot, {
  Header: AskUserHeader,
  Label: AskUserLabel,
  Navigation: AskUserNavigation,
  Previous: AskUserPrevious,
  Next: AskUserNext,
  StepLabel: AskUserStepLabel,
  Options: AskUserOptions,
  Option: AskUserOption,
  OptionContent: AskUserOptionContent,
  OptionLabel: AskUserOptionLabel,
  OptionDescription: AskUserOptionDescription,
  Hints: AskUserHints,
});
