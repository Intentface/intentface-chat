"use client";

// Headless ask-user questionnaire parts. Owns the option registration system
// (cmdk pattern), highlight state, and the imperative keyboard-navigation
// handle. Input widgets (checkbox/radio), icons, and the answered summary
// belong to the styled layer, which reads state via useAskUserOptions() /
// useAskUserOption(). Every part supports the Base UI render prop.

import {
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
import type { PrimitiveProps } from "./internal/primitive-props";
import { useRenderElement } from "./internal/render/useRenderElement";

/** AskUser root container. Stateless — consumers manage all state externally. */
export type AskUserRootProps = PrimitiveProps<"div">;

const AskUserRoot = ({ className, render, style, ...elementProps }: AskUserRootProps) =>
  useRenderElement(
    "div",
    { className, render, style },
    { props: [{ "data-slot": "ask-user" }, elementProps] },
  );

/** Question heading text. */
export type AskUserLabelProps = PrimitiveProps<"p">;

const AskUserLabel = ({ className, render, style, ...elementProps }: AskUserLabelProps) =>
  useRenderElement(
    "p",
    { className, render, style },
    { props: [{ "data-slot": "ask-user-label" }, elementProps] },
  );

/** Row container for `Label` and optional `Navigation`. */
export type AskUserHeaderProps = PrimitiveProps<"div">;

const AskUserHeader = ({ className, render, style, ...elementProps }: AskUserHeaderProps) =>
  useRenderElement(
    "div",
    { className, render, style },
    { props: [{ "data-slot": "ask-user-header" }, elementProps] },
  );

/** Row container for `Previous`, `StepLabel`, and `Next`. */
export type AskUserNavigationProps = PrimitiveProps<"div">;

const AskUserNavigation = ({ className, render, style, ...elementProps }: AskUserNavigationProps) =>
  useRenderElement(
    "div",
    { className, render, style },
    { props: [{ "data-slot": "ask-user-navigation" }, elementProps] },
  );

/** Navigate to the previous step. */
export type AskUserPreviousProps = PrimitiveProps<"button">;

const AskUserPrevious = ({ className, render, style, ...elementProps }: AskUserPreviousProps) =>
  useRenderElement(
    "button",
    { className, render, style },
    { props: [{ "data-slot": "ask-user-previous" }, elementProps] },
  );

/** Navigate to the next step. */
export type AskUserNextProps = PrimitiveProps<"button">;

const AskUserNext = ({ className, render, style, ...elementProps }: AskUserNextProps) =>
  useRenderElement(
    "button",
    { className, render, style },
    { props: [{ "data-slot": "ask-user-next" }, elementProps] },
  );

/** Displays "{current} of {total}" step indicator. Supports custom children to override the default text. */
export type AskUserStepLabelProps = PrimitiveProps<"span"> & {
  current: number;
  total: number;
};

const AskUserStepLabel = ({
  current,
  total,
  children,
  className,
  render,
  style,
  ...elementProps
}: AskUserStepLabelProps) =>
  useRenderElement(
    "span",
    { className, render, style },
    {
      props: [
        { "data-slot": "ask-user-step-label", children: children ?? `${current} / ${total}` },
        elementProps,
      ],
    },
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

export type AskUserOptionsProps = Omit<PrimitiveProps<"fieldset">, "value" | "ref"> & {
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
  className,
  render,
  style,
  children,
  ...elementProps
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

  const element = useRenderElement(
    "fieldset",
    { className, render, style },
    { props: [{ "data-slot": "ask-user-options", children }, elementProps] },
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
      {element}
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

export type AskUserOptionState = {
  /** Present as data-highlighted while keyboard/hover highlighted. */
  highlighted: boolean;
  /** Present as data-selected while the option is selected. */
  selected: boolean;
};

export type AskUserOptionProps = PrimitiveProps<"label", AskUserOptionState> & {
  value?: string;
  selected?: boolean;
  onSelect?: () => void;
};

const AskUserOption = ({
  value = "",
  selected = false,
  onSelect,
  className,
  render,
  style,
  children,
  ...elementProps
}: AskUserOptionProps) => {
  const id = useId();
  const { highlightedValue, register, onItemHover } = use(OptionsContext);
  const isHighlighted = value === highlightedValue;

  // Self-register on mount, deregister on unmount (true subscription side effect)
  const registerRef = useRef(register);
  registerRef.current = register;
  useItemRegistration(value, registerRef);

  const element = useRenderElement(
    "label",
    { className, render, style },
    {
      state: { highlighted: isHighlighted, selected },
      props: [
        {
          htmlFor: id,
          "data-slot": "ask-user-option",
          onMouseMove: () => onItemHover(value),
          children,
        },
        elementProps,
      ],
    },
  );

  return <OptionContext value={{ id, value, selected, onSelect }}>{element}</OptionContext>;
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
export type AskUserOptionContentProps = PrimitiveProps<"span">;

const AskUserOptionContent = ({
  className,
  render,
  style,
  ...elementProps
}: AskUserOptionContentProps) =>
  useRenderElement(
    "span",
    { className, render, style },
    { props: [{ "data-slot": "ask-user-option-content" }, elementProps] },
  );

/** Option title text. */
export type AskUserOptionLabelProps = PrimitiveProps<"span">;

const AskUserOptionLabel = ({
  className,
  render,
  style,
  ...elementProps
}: AskUserOptionLabelProps) =>
  useRenderElement(
    "span",
    { className, render, style },
    { props: [{ "data-slot": "ask-user-option-label" }, elementProps] },
  );

/** Option subtitle/description text. */
export type AskUserOptionDescriptionProps = PrimitiveProps<"span">;

const AskUserOptionDescription = ({
  className,
  render,
  style,
  ...elementProps
}: AskUserOptionDescriptionProps) =>
  useRenderElement(
    "span",
    { className, render, style },
    { props: [{ "data-slot": "ask-user-option-description" }, elementProps] },
  );

/** Keyboard shortcut hints displayed below the ask-user options. */
export type AskUserHintsProps = PrimitiveProps<"div">;

const AskUserHints = ({ className, render, style, ...elementProps }: AskUserHintsProps) =>
  useRenderElement(
    "div",
    { className, render, style },
    { props: [{ "data-slot": "ask-user-hints" }, elementProps] },
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
  OptionContent: AskUserOptionContent,
  OptionLabel: AskUserOptionLabel,
  OptionDescription: AskUserOptionDescription,
  Hints: AskUserHints,
});
