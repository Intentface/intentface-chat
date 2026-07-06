// Neutral alias over the vendored render machinery's component-props type —
// our primitives speak "PrimitiveProps", not the upstream brand. Adds an
// empty-state default so stateless primitives write PrimitiveProps<"div">.

import type * as React from "react";
import type { BaseUIComponentProps } from "./render/types";

export type EmptyState = Record<string, never>;

export type PrimitiveProps<
  ElementType extends React.ElementType,
  State = EmptyState,
> = BaseUIComponentProps<ElementType, State>;
