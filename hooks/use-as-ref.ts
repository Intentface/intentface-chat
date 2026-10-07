import { useLayoutEffect, useRef } from "react";

// Mirror a value into a ref so long-lived listeners always see the latest one
// without re-subscribing. The layout effect updates it before any event fires.
export const useAsRef = <T>(value: T) => {
  const ref = useRef(value);
  useLayoutEffect(() => {
    ref.current = value;
  });
  return ref;
};
