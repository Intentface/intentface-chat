// Bring a rect into view by scrolling the nearest scrollable ancestor of
// `from` just enough — but never one outside `boundary`. A primitive scrolls
// only its own scroll areas: walking further would reach the page around it
// (an embedded composer's docs page, say) and yank it, which is exactly what
// scrollIntoView does and why it isn't used. `boundary` itself may scroll.
export const scrollIntoViewWithin = (rect: DOMRect, from: HTMLElement, boundary: Element): void => {
  let scroller: HTMLElement | null = from;
  while (scroller && boundary.contains(scroller)) {
    const { overflowY } = getComputedStyle(scroller);
    if (
      (overflowY === "auto" || overflowY === "scroll") &&
      scroller.scrollHeight > scroller.clientHeight
    ) {
      break;
    }
    scroller = scroller.parentElement;
  }
  if (!scroller || !boundary.contains(scroller)) return;

  const view = scroller.getBoundingClientRect();
  if (rect.top < view.top) scroller.scrollTop -= view.top - rect.top;
  else if (rect.bottom > view.bottom) scroller.scrollTop += rect.bottom - view.bottom;
};
