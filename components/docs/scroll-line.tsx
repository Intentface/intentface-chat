"use client";

import { type ReactNode, useCallback, useState } from "react";

/**
 * One line that scrolls sideways with fading edges instead of wrapping. Only a
 * line that actually overflows joins the tab order, so keyboard readers in
 * browsers that don't focus scrollers (Safari) can reach the clipped text
 * without every short row adding a tab stop.
 */
export const ScrollLine = ({ label, children }: { label: string; children: ReactNode }) => {
  const [overflows, setOverflows] = useState(false);

  const ref = useCallback((node: HTMLDivElement | null) => {
    if (!node) return;
    const measure = () => setOverflows(node.scrollWidth > node.clientWidth);
    measure();
    // The scroller's box and its content's: a web font swapping in widens the
    // text without resizing the scroller.
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    if (node.firstElementChild) observer.observe(node.firstElementChild);
    return () => observer.disconnect();
  }, []);

  return (
    // The wrapper draws the focus ring: a mask also fades its own element's
    // outline, so the masked scroller can't show one whole.
    <div className="rounded-[inherit] has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-accent-bg/60 has-[:focus-visible]:-outline-offset-2">
      <div
        ref={ref}
        // Focus stays on the scroller, since arrow keys scroll the focused element.
        // Named and focusable only while it overflows (the scrollable-region pattern).
        role="group"
        aria-label={overflows ? label : undefined}
        tabIndex={overflows ? 0 : undefined}
        className="scroll-mask overflow-x-auto whitespace-nowrap px-4 py-3.5 outline-none [scrollbar-width:none]"
      >
        <span className="inline-block">{children}</span>
      </div>
    </div>
  );
};
