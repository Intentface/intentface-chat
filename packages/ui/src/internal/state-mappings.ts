// Shared state → data-attribute mappings for useRenderElement. Base UI
// convention: `open` produces a data-open / data-closed presence pair so both
// directions are styleable (exit transitions target data-closed).

import type { StateAttributesMapping } from "./render/getStateAttributesProps";
import type { TransitionStatus } from "./render/transition";

export const openStateMapping: StateAttributesMapping<{ open: boolean }> = {
  open: (value): Record<string, string> => (value ? { "data-open": "" } : { "data-closed": "" }),
};

// Base UI convention: the transitional frames of an open/close animation surface as
// data-starting-style (entering) / data-ending-style (exiting); settled states emit nothing.
export const transitionStatusMapping: StateAttributesMapping<{
  transitionStatus: TransitionStatus;
}> = {
  transitionStatus: (value): Record<string, string> | null => {
    if (value === "starting") return { "data-starting-style": "" };
    if (value === "ending") return { "data-ending-style": "" };
    return null;
  },
};
