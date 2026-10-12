// Scripted scroll animation for the thread. The styled layer owns the timing
// through CSS variables on the thread root; the thread owns the motion. When no
// timing is configured, callers fall back to the browser's native smooth scroll.

// Why a scroll was started. Stamped on the root as data-scrolling *before* the
// timing is read, so a selector can give each kind its own timing.
export type ThreadScrollKind = "land" | "follow" | "bottom" | "top" | "message";

// What the CSS variables configure. The duration itself is resolved per
// scroll, since a speed makes it depend on the distance.
export type ScrollTiming = {
  /** The fixed duration (ms); the cap when a speed is set. */
  duration: number | null;
  /** Pixels per second; null when the duration is fixed. */
  speed: number | null;
  easing: string;
};

const DEFAULT_EASING = "ease";

// A CSS <time>: "450ms" or "0.45s". Anything else (including unset) is null.
export const parseTime = (value: string): number | null => {
  const match = /^(-?\d*\.?\d+)(ms|s)$/i.exec(value.trim());
  if (!match) return null;
  const amount = Number(match[1]);
  return match[2]?.toLowerCase() === "s" ? amount * 1000 : amount;
};

// The shorthand reads like `transition`'s <duration> <easing>, so a Motion
// `spring()` string ("900ms linear(…)") drops straight in.
const parseShorthand = (value: string): { duration: number | null; easing: string } => {
  const [first = "", ...rest] = value.trim().split(/\s+/);
  const duration = parseTime(first);
  if (duration === null) return { duration: null, easing: value.trim() };
  return { duration, easing: rest.join(" ") };
};

type TimingStyle = Pick<CSSStyleDeclaration, "getPropertyValue">;

/**
 * Reads the scroll timing from the thread's CSS variables:
 *   --thread-scroll           shorthand `<duration> <easing>`, or `none`
 *   --thread-scroll-duration  longhand, overrides the shorthand; the cap when
 *                             a speed is also set
 *   --thread-scroll-easing    longhand, overrides the shorthand
 *   --thread-scroll-speed     px per second; duration = distance / speed
 * Returns null — the caller keeps the native smooth scroll — when neither a
 * duration nor a speed is set, or when the shorthand is `none`, which wins
 * over the longhands so a whole subtree can opt back out of a default.
 */
export const readScrollTiming = (style: TimingStyle): ScrollTiming | null => {
  const raw = style.getPropertyValue("--thread-scroll").trim();
  if (raw === "none") return null;
  const shorthand = parseShorthand(raw);
  const duration =
    parseTime(style.getPropertyValue("--thread-scroll-duration")) ?? shorthand.duration;
  const easing =
    style.getPropertyValue("--thread-scroll-easing").trim() || shorthand.easing || DEFAULT_EASING;
  const parsedSpeed = Number.parseFloat(style.getPropertyValue("--thread-scroll-speed"));
  const speed = parsedSpeed > 0 ? parsedSpeed : null;

  if (duration === null && speed === null) return null;
  return { duration, speed, easing };
};

// The duration (ms) for one scroll of `distance` px under `timing`.
export const resolveDuration = ({ duration, speed }: ScrollTiming, distance: number): number => {
  const paced = speed === null ? null : (Math.abs(distance) / speed) * 1000;
  const resolved =
    paced === null ? duration : duration === null ? paced : Math.min(duration, paced);
  return Math.max(0, resolved ?? 0);
};

// scrollIntoView's `block` alignment.
export type ScrollAlign = "start" | "center" | "end" | "nearest";

const px = (value: string) => Number.parseFloat(value) || 0;

// scroll-padding's computed value keeps percentages, which resolve against the
// scroll container's own height. (scroll-margin takes lengths only.)
const paddingPx = (value: string, height: number) =>
  value.trim().endsWith("%") ? (px(value) / 100) * height : px(value);

/**
 * The scrollTop that aligns `row` inside `scroller` the way scrollIntoView
 * would: honoring the row's scroll-margin and the scroller's scroll-padding,
 * clamped to the scroll range. Computed once — a scripted animation needs the
 * destination up front, which scrollIntoView never exposes.
 */
export const alignedScrollTop = (
  scroller: HTMLElement,
  row: HTMLElement,
  align: ScrollAlign,
): number => {
  const rowStyle = getComputedStyle(row);
  const scrollerStyle = getComputedStyle(scroller);
  const scrollerTop = scroller.getBoundingClientRect().top + scroller.clientTop;
  const rect = row.getBoundingClientRect();

  // Row edges in scroll coordinates, expanded by its scroll-margin.
  const rowTop = rect.top - scrollerTop + scroller.scrollTop - px(rowStyle.scrollMarginTop);
  const rowBottom =
    rect.bottom - scrollerTop + scroller.scrollTop + px(rowStyle.scrollMarginBottom);
  // The visible band, shrunk by the scroller's scroll-padding.
  const paddingTop = paddingPx(scrollerStyle.scrollPaddingTop, scroller.clientHeight);
  const paddingBottom = paddingPx(scrollerStyle.scrollPaddingBottom, scroller.clientHeight);
  const band = scroller.clientHeight - paddingTop - paddingBottom;
  const viewTop = scroller.scrollTop + paddingTop;
  const viewBottom = viewTop + band;

  const toStart = rowTop - paddingTop;
  const toEnd = rowBottom - paddingTop - band;
  const target = (() => {
    if (align === "start") return toStart;
    if (align === "end") return toEnd;
    if (align === "center") return (rowTop + rowBottom) / 2 - paddingTop - band / 2;
    // "nearest", per the CSSOM View rules: leave a row that is fully in view —
    // or that overflows the band at both edges — where it is; otherwise bring
    // in the edge that is out of view, or the top edge of a row too tall to fit.
    const fits = rowBottom - rowTop <= band;
    const above = rowTop < viewTop;
    const below = rowBottom > viewBottom;
    if (above === below) return scroller.scrollTop;
    return above === fits ? toStart : toEnd;
  })();

  const max = scroller.scrollHeight - scroller.clientHeight;
  return Math.min(Math.max(0, target), Math.max(0, max));
};

// The easing curve is evaluated by the browser: a target-less effect runs on
// the document timeline, and its computed progress is the eased progress — so
// every CSS easing works, linear() springs included, with no parser here. An
// easing the engine rejects falls back to the default. No fill: past the end
// the progress reads null, which the animator treats as done.
const createTimingEffect = (duration: number, easing: string): Animation => {
  const options: KeyframeEffectOptions = { duration, easing };
  try {
    return new Animation(new KeyframeEffect(null, null, options), document.timeline);
  } catch {
    const fallback = { ...options, easing: DEFAULT_EASING };
    return new Animation(new KeyframeEffect(null, null, fallback), document.timeline);
  }
};

export type ScrollAnimationOptions = {
  duration: number;
  easing: string;
  /**
   * Read every frame, so a destination that moves mid-flight (a reply
   * streaming in, the reserve resizing) is tracked instead of overshot.
   */
  getTarget: () => number;
  /** Runs once the animation reaches its end — not when it is cancelled. */
  onFinish: () => void;
};

/**
 * Animates `scroller` from its current scrollTop to `getTarget()`. One
 * scrollTo per frame; nothing runs between animations. Returns a cancel
 * function that stops it where it is.
 */
export const animateScroll = (
  scroller: HTMLElement,
  { duration, easing, getTarget, onFinish }: ScrollAnimationOptions,
): (() => void) => {
  const from = scroller.scrollTop;
  const timing = createTimingEffect(duration, easing);
  timing.play();

  let frame = 0;
  const step = () => {
    const progress = timing.effect?.getComputedTiming().progress ?? 1;
    // "instant" so a scroll-behavior: smooth on the scroller can't turn each
    // frame into a smooth scroll of its own.
    scroller.scrollTo({ top: from + (getTarget() - from) * progress, behavior: "instant" });
    if (timing.playState === "finished") {
      timing.cancel();
      onFinish();
      return;
    }
    frame = requestAnimationFrame(step);
  };
  frame = requestAnimationFrame(step);

  return () => {
    cancelAnimationFrame(frame);
    timing.cancel();
  };
};
