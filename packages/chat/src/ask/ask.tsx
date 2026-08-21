"use client";

// Headless ask parts — the request flow widget. Owns the option registration system
// (cmdk pattern), highlight state, and the imperative keyboard-navigation
// handle. Input widgets (checkbox/radio), icons, and the answered summary
// belong to the styled layer, which reads state via useAskOptions() /
// useAskOption(). Every part supports the Base UI render prop.

import {
  createContext,
  type ReactNode,
  type RefObject,
  use,
  useCallback,
  useId,
  useImperativeHandle,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { useComposer } from "../composer/store";
import type { PrimitiveProps } from "../internal/primitive-props";
import { useRenderElement } from "../internal/render/useRenderElement";

// Shared ids so Options can label itself from the request label and describe
// itself from the step indicator without any consumer wiring: Root mints both,
// Label/StepLabel stamp them, Options references them.
type AskIdsContextValue = { labelId: string; stepLabelId: string };

const AskIdsContext = createContext<AskIdsContextValue>({ labelId: "", stepLabelId: "" });

/** Ask root container. Stateless — consumers manage all state externally. */
export type AskRootProps = PrimitiveProps<"div">;

export const AskRoot = ({ className, render, style, ...elementProps }: AskRootProps) => {
  const labelId = useId();
  const stepLabelId = useId();
  const element = useRenderElement(
    "div",
    { className, render, style },
    { props: [{ "data-ask": "" }, elementProps] },
  );
  return <AskIdsContext value={{ labelId, stepLabelId }}>{element}</AskIdsContext>;
};

/** Request label text. Carries the id `Options` uses as its accessible name. */
export type AskLabelProps = PrimitiveProps<"p">;

export const AskLabel = ({ className, render, style, ...elementProps }: AskLabelProps) => {
  const { labelId } = use(AskIdsContext);
  return useRenderElement(
    "p",
    { className, render, style },
    { props: [{ id: labelId || undefined, "data-ask-label": "" }, elementProps] },
  );
};

/** Row container for `Label` and optional `Navigation`. */
export type AskHeaderProps = PrimitiveProps<"div">;

export const AskHeader = ({ className, render, style, ...elementProps }: AskHeaderProps) =>
  useRenderElement(
    "div",
    { className, render, style },
    { props: [{ "data-ask-header": "" }, elementProps] },
  );

/** Row container for `Previous`, `StepLabel`, and `Next`. */
export type AskNavigationProps = PrimitiveProps<"div">;

export const AskNavigation = ({ className, render, style, ...elementProps }: AskNavigationProps) =>
  useRenderElement(
    "div",
    { className, render, style },
    { props: [{ "data-ask-navigation": "" }, elementProps] },
  );

/** Navigate to the previous step. Default accessible name; override via aria-label. */
export type AskPreviousProps = PrimitiveProps<"button">;

export const AskPrevious = ({ className, render, style, ...elementProps }: AskPreviousProps) =>
  useRenderElement(
    "button",
    { className, render, style },
    { props: [{ "aria-label": "Previous question", "data-ask-previous": "" }, elementProps] },
  );

/** Navigate to the next step. Default accessible name; override via aria-label. */
export type AskNextProps = PrimitiveProps<"button">;

export const AskNext = ({ className, render, style, ...elementProps }: AskNextProps) =>
  useRenderElement(
    "button",
    { className, render, style },
    { props: [{ "aria-label": "Next question", "data-ask-next": "" }, elementProps] },
  );

/** Step indicator. Reads the current step + total from the composer store; the
 * consumer supplies the text via `children` — either a node, or a callback
 * receiving `{ current, total }` (1-based current). No default format. */
export type AskStepLabelState = { current: number; total: number };

export type AskStepLabelProps = Omit<PrimitiveProps<"span">, "children"> & {
  children?: ReactNode | ((state: AskStepLabelState) => ReactNode);
};

export const AskStepLabel = ({
  children,
  className,
  render,
  style,
  ...elementProps
}: AskStepLabelProps) => {
  const current = useComposer((composer) => composer.requests.step) + 1;
  const total = useComposer((composer) => composer.requests.items?.length ?? 0);
  const { stepLabelId } = use(AskIdsContext);
  const content = typeof children === "function" ? children({ current, total }) : children;

  return useRenderElement(
    "span",
    { className, render, style },
    {
      props: [
        { id: stepLabelId || undefined, "data-ask-step-label": "", children: content },
        elementProps,
      ],
    },
  );
};

/** Fieldset wrapper for `Option` items. Provides `multiSelect`, `groupName`, and highlight state to child options via context. Items self-register on mount (cmdk pattern). */
type OptionsContextValue = {
  multiSelect: boolean;
  groupName: string;
  highlightedValue: string | null;
  items: RefObject<string[]>;
  register: (value: string, getElement: () => HTMLElement | null) => () => void;
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

export const useAskOptions = () => use(OptionsContext);

/** Imperative handle exposed by `Ask.Options` for keyboard navigation. */
export type AskOptionsHandle = {
  /** Move highlight by direction, focusing the newly highlighted option (roving tabindex). Returns the new highlighted value (null = past the list boundary). */
  navigate: (direction: number) => string | null;
  select: () => { value: string } | null;
  clearHighlight: () => void;
  resetHighlight: () => void;
  /** Move DOM focus onto the highlighted option (or the first option when none is highlighted). */
  focusHighlighted: () => void;
  /** The options container element — the composer attaches its request-mode keydown handling here. */
  getElement: () => HTMLElement | null;
  highlightedValue: string | null;
};

export type AskOptionsProps = Omit<PrimitiveProps<"fieldset">, "value" | "ref"> & {
  /** When true, options render as multi-select (checkbox semantics in the styled layer). */
  multiSelect?: boolean;
  /** Shared `name` attribute for all option inputs in this group. */
  groupName?: string;
  /** Imperative ref for keyboard navigation (navigate, select, clearHighlight, resetHighlight). */
  ref?: RefObject<AskOptionsHandle | null>;
};

export const AskOptions = ({
  multiSelect = false,
  groupName = "",
  ref,
  className,
  render,
  style,
  children,
  ...elementProps
}: AskOptionsProps) => {
  const registeredItems = useRef<string[]>([]);
  const itemElements = useRef<Map<string, () => HTMLElement | null>>(new Map());
  const containerRef = useRef<HTMLFieldSetElement | null>(null);
  const { labelId, stepLabelId } = use(AskIdsContext);
  const [highlightedValue, setHighlightedValue] = useState<string | null>(null);

  // Track highlight in a ref so imperative methods see latest value without re-binding
  const highlightedValueRef = useRef(highlightedValue);
  highlightedValueRef.current = highlightedValue;

  const register = useCallback((itemValue: string, getElement: () => HTMLElement | null) => {
    registeredItems.current = [...registeredItems.current, itemValue];
    itemElements.current.set(itemValue, getElement);
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
      itemElements.current.delete(itemValue);
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

  // Roving tabindex: DOM focus follows the highlight for keyboard navigation.
  const focusValue = useCallback((itemValue: string | null) => {
    if (itemValue === null) return;
    itemElements.current.get(itemValue)?.()?.focus();
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
        focusValue(next);
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
      focusHighlighted: () => {
        const target = highlightedValueRef.current ?? registeredItems.current[0] ?? null;
        if (target !== null && highlightedValueRef.current === null) {
          highlightedValueRef.current = target;
          setHighlightedValue(target);
        }
        focusValue(target);
      },
      getElement: () => containerRef.current,
      get highlightedValue() {
        return highlightedValueRef.current;
      },
    }),
    [focusValue],
  );

  const element = useRenderElement(
    "fieldset",
    { className, render, style },
    {
      ref: containerRef,
      props: [
        {
          // The options are the real selectable controls (role radio/checkbox
          // on each option), so the container is their labelled group.
          role: multiSelect ? "group" : "radiogroup",
          "aria-labelledby": labelId || undefined,
          "aria-describedby": stepLabelId || undefined,
          "data-ask-options": "",
          children,
        },
        elementProps,
      ],
    },
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

export const useAskOption = () => use(OptionContext);

export type AskOptionState = {
  /** Present as data-highlighted while keyboard/hover highlighted. */
  highlighted: boolean;
  /** Present as data-selected while the option is selected. */
  selected: boolean;
};

export type AskOptionProps = PrimitiveProps<"label", AskOptionState> & {
  value?: string;
  selected?: boolean;
  onSelect?: () => void;
};

export const AskOption = ({
  value = "",
  selected = false,
  onSelect,
  className,
  render,
  style,
  children,
  ...elementProps
}: AskOptionProps) => {
  const id = useId();
  const { multiSelect, highlightedValue, register, onItemHover } = use(OptionsContext);
  const optionRef = useRef<HTMLLabelElement | null>(null);
  const isHighlighted = value === highlightedValue;

  // Self-register on mount, deregister on unmount (true subscription side effect)
  const registerRef = useRef(register);
  registerRef.current = register;
  useItemRegistration(value, registerRef, optionRef);

  const element = useRenderElement(
    "label",
    { className, render, style },
    {
      ref: optionRef,
      state: { highlighted: isHighlighted, selected },
      props: [
        {
          // The option IS the selectable control: role + checked state live
          // here, and the roving tabindex makes the highlighted option the
          // group's single tab stop. Never a native input — the composer's
          // request-mode key scoping treats inputs as foreign editables.
          id,
          role: multiSelect ? "checkbox" : "radio",
          "aria-checked": selected,
          tabIndex: isHighlighted ? 0 : -1,
          "data-ask-option": "",
          onMouseMove: () => onItemHover(value),
          // Keep highlight and DOM focus unified when focus arrives by other
          // means (Tab into the group, SR virtual-cursor activation).
          onFocus: () => onItemHover(value),
          // Self-contained click selection. The option itself is the control
          // now, so only a *different* nested interactive element defers —
          // a bare option stays fully clickable.
          onClick: (event: React.MouseEvent<HTMLLabelElement>) => {
            const nested = (event.target as HTMLElement).closest(
              "input,button,[role=checkbox],[role=radio]",
            );
            if (nested && nested !== event.currentTarget) return;
            event.preventDefault();
            onSelect?.();
          },
          children,
        },
        elementProps,
      ],
    },
  );

  return <OptionContext value={{ id, value, selected, onSelect }}>{element}</OptionContext>;
};

/** Registers an item value + element with the parent Options container synchronously before paint and deregisters on unmount. */
const useItemRegistration = (
  value: string,
  registerRef: RefObject<(value: string, getElement: () => HTMLElement | null) => () => void>,
  elementRef: RefObject<HTMLElement | null>,
) => {
  // useLayoutEffect ensures items are registered before paint so the initial highlight resolves immediately
  useLayoutEffect(() => {
    return registerRef.current(value, () => elementRef.current);
  }, [value, registerRef, elementRef]);
};

/** Flex column wrapper for `OptionLabel` and `OptionDescription`. */
export type AskOptionContentProps = PrimitiveProps<"span">;

export const AskOptionContent = ({
  className,
  render,
  style,
  ...elementProps
}: AskOptionContentProps) =>
  useRenderElement(
    "span",
    { className, render, style },
    { props: [{ "data-ask-option-content": "" }, elementProps] },
  );

/** Option title text. */
export type AskOptionLabelProps = PrimitiveProps<"span">;

export const AskOptionLabel = ({
  className,
  render,
  style,
  ...elementProps
}: AskOptionLabelProps) =>
  useRenderElement(
    "span",
    { className, render, style },
    { props: [{ "data-ask-option-label": "" }, elementProps] },
  );

/** Option subtitle/description text. */
export type AskOptionDescriptionProps = PrimitiveProps<"span">;

export const AskOptionDescription = ({
  className,
  render,
  style,
  ...elementProps
}: AskOptionDescriptionProps) =>
  useRenderElement(
    "span",
    { className, render, style },
    { props: [{ "data-ask-option-description": "" }, elementProps] },
  );

/** Keyboard shortcut hints displayed below the ask options. */
export type AskHintsProps = PrimitiveProps<"div">;

export const AskHints = ({ className, render, style, ...elementProps }: AskHintsProps) =>
  useRenderElement(
    "div",
    { className, render, style },
    { props: [{ "data-ask-hints": "" }, elementProps] },
  );

/** Dismiss/skip button. Stateless — wire `onClick` to your dismiss handler. */
export type AskDismissProps = PrimitiveProps<"button">;

export const AskDismiss = ({ className, render, style, ...elementProps }: AskDismissProps) =>
  useRenderElement(
    "button",
    { className, render, style },
    { props: [{ type: "button" as const, "data-ask-dismiss": "" }, elementProps] },
  );

/** Continue/submit button — `type=submit` so the enclosing form drives it. */
export type AskContinueProps = PrimitiveProps<"button">;

export const AskContinue = ({ className, render, style, ...elementProps }: AskContinueProps) =>
  useRenderElement(
    "button",
    { className, render, style },
    { props: [{ type: "submit" as const, "data-ask-continue": "" }, elementProps] },
  );
