// Vendored from @base-ui/react v1.6.0 (MIT) — packages/react/src/types/index.ts
// https://github.com/mui/base-ui — subset: the createBaseUIEventDetails re-export
// is dropped (unused by the render machinery); otherwise an exact copy.

import type * as React from 'react';

export type HTMLProps<T = any> = React.HTMLAttributes<T> & {
  ref?: React.Ref<T> | undefined;
};

// Local departure from upstream: primitives stamp bespoke part attributes
// (data-composer-root, data-thread-scroller, …) in plain props objects, and
// TS only special-cases data-* keys inside JSX literals. A union — not an
// intersection on HTMLProps and not a React module augmentation — so plain
// HTMLAttributes values stay assignable and nothing leaks into consumer apps
// (a global augmentation broke react-markdown's Components type).
export type WithDataAttributes<Props> =
  | Props
  | (Props & { [dataAttribute: `data-${string}`]: string | undefined });

/**
 * Shape of the render prop: a function that takes props to be spread on the element and component's state and returns a React element.
 *
 * @template Props Props to be spread on the rendered element.
 * @template State Component's internal state.
 */
export type ComponentRenderFn<Props, State> = (
  props: Props,
  state: State,
) => React.ReactElement<unknown>;

export type BaseUIEvent<E extends React.SyntheticEvent<Element, Event>> = E & {
  preventBaseUIHandler: () => void;
  readonly baseUIHandlerPrevented?: boolean | undefined;
};
