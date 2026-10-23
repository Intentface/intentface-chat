import { type RefCallback, useCallback, useState } from "react";

export const useMeasure = <T extends HTMLElement = HTMLElement>(): [
  RefCallback<T>,
  { width: number; height: number },
] => {
  const [bounds, setBounds] = useState({ width: 0, height: 0 });

  // Observes the element while it's attached: React runs the returned cleanup when it detaches.
  const ref = useCallback((node: T | null) => {
    if (!node) return;

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

    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return [ref, bounds];
};
