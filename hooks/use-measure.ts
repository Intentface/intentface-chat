import { useCallback, useEffect, useState } from "react";

export const useMeasure = <T extends HTMLElement = HTMLElement>(): [
  (node: T | null) => void,
  { width: number; height: number },
] => {
  const [element, setElement] = useState<T | null>(null);
  const [bounds, setBounds] = useState({ width: 0, height: 0 });

  const ref = useCallback((node: T | null) => {
    setElement(node);
  }, []);

  useEffect(() => {
    if (!element) return;

    const observer = new ResizeObserver(([entry]) => {
      // Border box (includes padding + border), not contentRect — callers size a
      // container to this element, so a border on the measured node must count or
      // it gets clipped. Fall back to contentRect where borderBoxSize is absent.
      const borderBox = entry.borderBoxSize?.[0];
      setBounds({
        width: borderBox ? borderBox.inlineSize : entry.contentRect.width,
        height: borderBox ? borderBox.blockSize : entry.contentRect.height,
      });
    });

    observer.observe(element);
    return () => observer.disconnect();
  }, [element]);

  return [ref, bounds];
};
