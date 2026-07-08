// Pure DOM geometry + measurement for the thread scroll subsystem. No React —
// unit-testable with stubbed elements/rects.

// Single place that performs the scroll, so callers just choose the behavior:
// 'instant' for jumps that must not animate, 'smooth' for deliberate movements.
export const scrollContainerTo = (el: HTMLElement, top: number, behavior: ScrollBehavior) => {
  el.scrollTo({ top, behavior });
};

// A prepend = rows were added, nothing removed, and the previously-first row
// is still connected but no longer first (older history loading in above).
export const wasPrepended = (
  mutations: MutationRecord[],
  previousFirst: Element | null,
  content: HTMLElement,
) =>
  previousFirst?.isConnected === true &&
  content.firstElementChild !== previousFirst &&
  mutations.some((m) => m.addedNodes.length > 0) &&
  mutations.every((m) => m.removedNodes.length === 0);

// Fallback (px) until the composer is measured.
export const DEFAULT_BOTTOM_OFFSET = 128;
// Breathing room between the last line of content and the composer dock. The
// bottom overlay spans it in the styled layer.
const COMPOSER_GAP = 32;
export const DEFAULT_DOCK_SELECTOR =
  '[data-slot="composer-context-window"], [data-slot="composer-container"]';

// `dockSelector` is public API, so it may be an invalid selector string.
// Degrade to "no dock parts" rather than letting querySelectorAll throw a
// SyntaxError inside the layout effect (which would crash the render).
export const queryDockParts = (root: HTMLElement, dockSelector: string): Element[] => {
  try {
    return [...root.querySelectorAll(dockSelector)];
  } catch {
    return [];
  }
};

/**
 * Height (px) to reserve at the bottom for the dock parts matching
 * `dockSelector` — but NOT the command-list / ask-user panel. The dock is
 * bottom-anchored, so it sits in a fixed region while the panel grows upward
 * above it. The inset is measured from a single reference — the bottom-most
 * match's top to the root's bottom — not a sum of matches, so a taller part
 * stacked above must fit within COMPOSER_GAP. Returns null when no dock is
 * mounted yet.
 */
export const measureDockInset = (root: HTMLElement, dockSelector: string): number | null => {
  let dockTop: number | null = null;
  for (const part of queryDockParts(root, dockSelector)) {
    const top = part.getBoundingClientRect().top;
    if (dockTop === null || top > dockTop) dockTop = top;
  }
  if (dockTop === null) return null;
  return Math.round(root.getBoundingClientRect().bottom - dockTop + COMPOSER_GAP);
};

// Top inset reserved by the top overlay, measured straight off the rendered
// element (px) — no getComputedStyle / rem→px conversion. 0 if no top overlay.
export const measureTopInset = (root: HTMLElement): number =>
  root.querySelector('[data-slot="thread-overlay-top"]')?.getBoundingClientRect().height ?? 0;
