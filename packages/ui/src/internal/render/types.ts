// Vendored from @base-ui/react v1.6.0 (MIT) — packages/react/src/internals/types.ts
// https://github.com/mui/base-ui — import specifiers rewired and names made neutral; otherwise an exact copy.

import type * as React from 'react';
import type { PreventableEvent, ComponentRenderFn, HTMLProps } from './baseTypes';

export type { HTMLProps, PreventableEvent, ComponentRenderFn };

export type MaybePreventableEvent<E extends React.SyntheticEvent<Element, Event>> = E &
  Partial<Pick<PreventableEvent<E>, 'preventPrimitiveHandler' | 'primitiveHandlerPrevented'>>;

export interface FloatingUIOpenChangeDetails {
  open: boolean;
  reason: string;
  nativeEvent: Event;
  nested: boolean;
  triggerElement?: Element | undefined;
}

type WithPreventableHandler<T> = T extends (event: infer E) => any
  ? E extends React.SyntheticEvent<Element, Event>
    ? (event: PreventableEvent<E>) => ReturnType<T>
    : T
  : T extends undefined
    ? undefined
    : T;

/**
 * Adds a `preventPrimitiveHandler` method to all event handlers.
 */
export type WithPreventableEvents<T> = {
  [K in keyof T]: WithPreventableHandler<T[K]>;
};

/**
 * Props shared by all primitive parts.
 * Contains `className` (string or callback taking the component's state as an argument) and `render` (function to customize rendering).
 */
export type RenderComponentProps<
  ElementType extends React.ElementType,
  State,
  RenderFunctionProps = HTMLProps,
> = Omit<
  WithPreventableEvents<React.ComponentPropsWithRef<ElementType>>,
  'className' | 'color' | 'defaultValue' | 'defaultChecked' | 'style'
> & {
  /**
   * CSS class applied to the element, or a function that
   * returns a class based on the component's state.
   */
  className?: string | ((state: State) => string | undefined) | undefined;
  /**
   * Allows you to replace the component's HTML element
   * with a different tag, or compose it with another component.
   *
   * Accepts a `ReactElement` or a function that returns the element to render.
   */
  render?: React.ReactElement | ComponentRenderFn<RenderFunctionProps, State> | undefined;
  /**
   * Style applied to the element, or a function that
   * returns a style object based on the component's state.
   */
  style?: React.CSSProperties | ((state: State) => React.CSSProperties | undefined) | undefined;
};

export interface NativeButtonProps {
  /**
   * Whether the component renders a native `<button>` element when replacing it
   * via the `render` prop.
   * Set to `false` if the rendered element is not a button (for example, `<div>`).
   * @default true
   */
  nativeButton?: boolean | undefined;
}

export interface NonNativeButtonProps {
  /**
   * Whether the component renders a native `<button>` element when replacing it
   * via the `render` prop.
   * Set to `true` if the rendered element is a native button.
   * @default false
   */
  nativeButton?: boolean | undefined;
}

/**
 * Simplifies the display of a type (without modifying it).
 * Taken from https://effectivetypescript.com/2022/02/25/gentips-4-display/
 */
export type Simplify<T> = T extends Function ? T : { [K in keyof T]: T[K] };

/**
 * Makes specified keys in a type required.
 *
 * @template T - The original type.
 * @template K - The keys to make required.
 */
export type RequiredExcept<T, K extends keyof T> = Required<Omit<T, K>> & Pick<T, K>;

export type Orientation = 'horizontal' | 'vertical';
