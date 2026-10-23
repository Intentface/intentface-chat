// Alias over the vendored render machinery's component-props type. Adds an
// empty-state default so stateless primitives write PrimitiveProps<"div">.

import type * as React from "react";
import type { RenderComponentProps } from "./render/types";

export type EmptyState = Record<string, never>;

export type PrimitiveProps<
  ElementType extends React.ElementType,
  State = EmptyState,
> = RenderComponentProps<ElementType, State>;
