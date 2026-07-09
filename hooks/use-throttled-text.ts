import { useEffect, useRef, useState } from "react";

// Holds the current value for at least `delay` ms before showing the next, so a
// rapidly-changing label (e.g. fast tool calls) doesn't flicker past — intermediate
// changes coalesce to the most recent. A genuine timer, not derived state-sync.
export const useThrottledText = (value: string, delay = 250): string => {
  const [shown, setShown] = useState(value);
  const lastShownAt = useRef(0);

  useEffect(() => {
    const elapsed = Date.now() - lastShownAt.current;
    if (elapsed >= delay) {
      lastShownAt.current = Date.now();
      setShown(value);
      return;
    }
    const timer = setTimeout(() => {
      lastShownAt.current = Date.now();
      setShown(value);
    }, delay - elapsed);
    return () => clearTimeout(timer);
  }, [value, delay]);

  return shown;
};
