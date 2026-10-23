// Adapted from @floating-ui/react v0.27.20 (MIT) — packages/react/src/safePolygon.ts
// https://github.com/floating-ui/floating-ui — the same geometry, trimmed to one
// floating element with no nested tree, and typed to the fields it reads.

export type Side = "top" | "right" | "bottom" | "left";

type Point = [number, number];

export type SafePolygonOptions = {
  /** Where the mouse left the reference. */
  x: number;
  y: number;
  /** Which side of the reference the floating element sits on. */
  side: Side;
  reference: Element;
  floating: Element;
  /** Called once the mouse leaves the safe area. */
  onClose: () => void;
};

const BUFFER = 0.5;
/** Slower than this, in px per ms, the mouse has stopped heading anywhere. */
const INTENT_SPEED = 0.1;
/** How long a mouse inside the cone may take to land before it counts as gone. */
const LANDING_TIMEOUT = 40;

const isPointInPolygon = ([x, y]: Point, polygon: Point[]) => {
  let inside = false;
  for (let index = 0, previous = polygon.length - 1; index < polygon.length; previous = index++) {
    const [currentX, currentY] = polygon[index] ?? [0, 0];
    const [previousX, previousY] = polygon[previous] ?? [0, 0];
    const crosses =
      currentY >= y !== previousY >= y &&
      x <= ((previousX - currentX) * (y - currentY)) / (previousY - currentY) + currentX;
    if (crosses) inside = !inside;
  }
  return inside;
};

const isInsideRect = ([x, y]: Point, rect: DOMRect) =>
  x >= rect.x && x <= rect.x + rect.width && y >= rect.y && y <= rect.y + rect.height;

const contains = (parent: Element, target: EventTarget | null) =>
  target instanceof Node && parent.contains(target);

/** The rectangular gap between the two elements, which always counts as safe. */
const troughBetween = (side: Side, reference: DOMRect, floating: DOMRect): Point[] => {
  const floatingWider = floating.width > reference.width;
  const floatingTaller = floating.height > reference.height;
  const left = (floatingWider ? reference : floating).left;
  const right = (floatingWider ? reference : floating).right;
  const top = (floatingTaller ? reference : floating).top;
  const bottom = (floatingTaller ? reference : floating).bottom;

  switch (side) {
    case "top":
      return [
        [left, reference.top + 1],
        [left, floating.bottom - 1],
        [right, floating.bottom - 1],
        [right, reference.top + 1],
      ];
    case "bottom":
      return [
        [left, floating.top + 1],
        [left, reference.bottom - 1],
        [right, reference.bottom - 1],
        [right, floating.top + 1],
      ];
    case "left":
      return [
        [floating.right - 1, bottom],
        [floating.right - 1, top],
        [reference.left + 1, top],
        [reference.left + 1, bottom],
      ];
    case "right":
      return [
        [reference.right - 1, bottom],
        [reference.right - 1, top],
        [floating.left + 1, top],
        [floating.left + 1, bottom],
      ];
  }
};

/** The triangle from where the mouse left to the near edge of the floating element. */
const coneFrom = ([x, y]: Point, side: Side, reference: DOMRect, floating: DOMRect): Point[] => {
  const floatingWider = floating.width > reference.width;
  const floatingTaller = floating.height > reference.height;
  const leftFromRight = x > floating.right - floating.width / 2;
  const leftFromBottom = y > floating.bottom - floating.height / 2;
  // Two points either side of the cursor, so the triangle has a base to start from.
  const acrossX = (spread: 1 | -1) =>
    floatingWider ? x + (spread * BUFFER) / 2 : leftFromRight ? x + BUFFER * 4 : x - BUFFER * 4;
  const acrossY = (spread: 1 | -1) =>
    floatingTaller ? y + (spread * BUFFER) / 2 : leftFromBottom ? y + BUFFER * 4 : y - BUFFER * 4;

  switch (side) {
    case "top": {
      const nearEdge = floating.bottom - BUFFER;
      return [
        [acrossX(1), y + BUFFER + 1],
        [acrossX(-1), y + BUFFER + 1],
        [floating.left, leftFromRight || floatingWider ? nearEdge : floating.top],
        [floating.right, leftFromRight ? (floatingWider ? nearEdge : floating.top) : nearEdge],
      ];
    }
    case "bottom": {
      const nearEdge = floating.top + BUFFER;
      return [
        [acrossX(1), y - BUFFER],
        [acrossX(-1), y - BUFFER],
        [floating.left, leftFromRight || floatingWider ? nearEdge : floating.bottom],
        [floating.right, leftFromRight ? (floatingWider ? nearEdge : floating.bottom) : nearEdge],
      ];
    }
    case "left": {
      const nearEdge = floating.right - BUFFER;
      return [
        [leftFromBottom || floatingTaller ? nearEdge : floating.left, floating.top],
        [leftFromBottom ? (floatingTaller ? nearEdge : floating.left) : nearEdge, floating.bottom],
        [x + BUFFER + 1, acrossY(1)],
        [x + BUFFER + 1, acrossY(-1)],
      ];
    }
    case "right": {
      const nearEdge = floating.left + BUFFER;
      return [
        [x - BUFFER, acrossY(1)],
        [x - BUFFER, acrossY(-1)],
        [leftFromBottom || floatingTaller ? nearEdge : floating.right, floating.top],
        [leftFromBottom ? (floatingTaller ? nearEdge : floating.right) : nearEdge, floating.bottom],
      ];
    }
  }
};

/**
 * The prediction cone: keeps a floating element open while the mouse travels
 * from its reference towards it. `onMouseMove` listens on the document and calls
 * `onClose` once the mouse leaves the safe area; `stop` cancels a pending check.
 */
export const createSafePolygon = ({
  x,
  y,
  side,
  reference,
  floating,
  onClose,
}: SafePolygonOptions) => {
  let landingTimer: ReturnType<typeof setTimeout> | undefined;
  let hasLanded = false;
  let lastPoint: Point | null = null;
  let lastTime = performance.now();

  const speedTo = ([pointX, pointY]: Point) => {
    const now = performance.now();
    const elapsed = now - lastTime;
    const previous = lastPoint;
    lastPoint = [pointX, pointY];
    lastTime = now;
    if (!previous || elapsed === 0) return null;
    return Math.hypot(pointX - previous[0], pointY - previous[1]) / elapsed;
  };

  const close = () => {
    clearTimeout(landingTimer);
    onClose();
  };

  const onMouseMove = (event: MouseEvent) => {
    clearTimeout(landingTimer);

    const point: Point = [event.clientX, event.clientY];
    const target = event.composedPath?.()[0] ?? event.target;
    const leaving = event.type === "mouseleave";
    const overFloating = contains(floating, target);
    const overReference = contains(reference, target);
    const referenceRect = reference.getBoundingClientRect();
    const floatingRect = floating.getBoundingClientRect();

    if (overFloating) {
      hasLanded = true;
      if (!leaving) return;
    }
    if (overReference) hasLanded = false;
    if (overReference && !leaving) {
      hasLanded = true;
      return;
    }
    // An overlapping floating element would otherwise loop between open and closed.
    if (leaving && contains(floating, event.relatedTarget)) return;

    // Leaving from the far side; the buffer would otherwise keep it open. 1px covers rounding.
    const leftFromFarSide =
      (side === "top" && y >= referenceRect.bottom - 1) ||
      (side === "bottom" && y <= referenceRect.top + 1) ||
      (side === "left" && x >= referenceRect.right - 1) ||
      (side === "right" && x <= referenceRect.left + 1);
    if (leftFromFarSide) return close();

    if (isPointInPolygon(point, troughBetween(side, referenceRect, floatingRect))) return;
    if (hasLanded && !isInsideRect(point, referenceRect)) return close();

    if (!leaving) {
      const speed = speedTo(point);
      if (speed !== null && speed < INTENT_SPEED) return close();
    }

    if (!isPointInPolygon(point, coneFrom([x, y], side, referenceRect, floatingRect))) close();
    else if (!hasLanded) landingTimer = setTimeout(close, LANDING_TIMEOUT);
  };

  return { onMouseMove, stop: () => clearTimeout(landingTimer) };
};
