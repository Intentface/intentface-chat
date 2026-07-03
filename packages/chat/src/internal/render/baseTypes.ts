// Vendored from @base-ui/react v1.6.0 (MIT) — packages/react/src/types/index.ts
// https://github.com/mui/base-ui — subset: the createBaseUIEventDetails re-export
// is dropped (unused by the render machinery); otherwise an exact copy.

import type * as React from 'react';

export type HTMLProps<T = any> = React.HTMLAttributes<T> & {
  ref?: React.Ref<T> | undefined;
};

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
