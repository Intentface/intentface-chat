"use client";

import { useCallback, useRef, useState } from "react";

/**
 * Controlled/uncontrolled state, decided once.
 *
 * Whether a component is controlled is latched on the first render and never
 * re-read. A component that flipped mid-life would silently drop state, so in
 * development the flip is reported — loudly, but without throwing, since a
 * render-time throw makes the very UI you need to inspect disappear.
 *
 * The setter is a no-op while controlled: whoever owns `value` is the only
 * thing that can change it.
 */
export const useControlled = <Value>({
  controlled,
  default: defaultValue,
  name,
  state = "value",
}: {
  controlled: Value | undefined;
  default: Value;
  /** Component name, for the development warning. */
  name: string;
  /** Prop name, for the development warning. */
  state?: string;
}) => {
  const isControlledRef = useRef(controlled !== undefined);
  const isControlled = isControlledRef.current;
  const [uncontrolledValue, setUncontrolledValue] = useState(defaultValue);

  if (process.env.NODE_ENV !== "production" && isControlled !== (controlled !== undefined)) {
    console.error(
      `[@intentface/chat] ${name} is switching between controlled and uncontrolled for \`${state}\`. ` +
        "Pick one for the component's lifetime: pass the prop always, or never.",
    );
  }

  // Reads the ref rather than the destructured value, so the dependency list is
  // genuinely empty and the setter's identity never changes.
  const setValueIfUncontrolled = useCallback((next: Value) => {
    if (isControlledRef.current) return;
    setUncontrolledValue(next);
  }, []);

  return [
    isControlled ? (controlled as Value) : uncontrolledValue,
    setValueIfUncontrolled,
  ] as const;
};
