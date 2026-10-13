// Bring a rect into view by scrolling each scrollable ancestor of `from` just
// enough — but never one outside `boundary`. A primitive scrolls only its own
// scroll areas: walking further would reach the page around it (an embedded
// composer's docs page, say) and yank it, which is exactly what scrollIntoView
// does and why it isn't used. `boundary` itself may scroll.
export const scrollIntoViewWithin = (rect: DOMRect, from: HTMLElement, boundary: Element): void => {
  let { top, bottom } = rect;
  let scroller: HTMLElement | null = from;
  while (scroller && boundary.contains(scroller)) {
    const { overflowY } = getComputedStyle(scroller);
    if (
      (overflowY === "auto" || overflowY === "scroll") &&
      scroller.scrollHeight > scroller.clientHeight
    ) {
      const view = scroller.getBoundingClientRect();
      const before = scroller.scrollTop;
      if (top < view.top) scroller.scrollTop -= view.top - top;
      else if (bottom > view.bottom) scroller.scrollTop += bottom - view.bottom;
      // The rect moves with the scrolled content; carry that to the next scroller out.
      const moved = scroller.scrollTop - before;
      top -= moved;
      bottom -= moved;
    }
    scroller = scroller.parentElement;
  }
};
