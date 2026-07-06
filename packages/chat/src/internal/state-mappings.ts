// Shared state → data-attribute mappings for useRenderElement. Base UI
// convention: `open` produces a data-open / data-closed presence pair so both
// directions are styleable (exit transitions target data-closed).

import type { StateAttributesMapping } from "./render/getStateAttributesProps";

export const openStateMapping: StateAttributesMapping<{ open: boolean }> = {
  open: (value): Record<string, string> => (value ? { "data-open": "" } : { "data-closed": "" }),
};
