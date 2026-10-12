import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { act, fireEvent, render, screen } from "@testing-library/react";
import type { CSSProperties } from "react";
import { Thread, useThread } from "../src/thread";
import {
  alignedScrollTop,
  animateScroll,
  parseTime,
  readScrollTiming,
  resolveDuration,
} from "../src/thread/scroll-animation";

describe("parseTime", () => {
  test("reads milliseconds and seconds", () => {
    expect(parseTime("450ms")).toBe(450);
    expect(parseTime(" 0.45s ")).toBe(450);
    expect(parseTime(".2s")).toBe(200);
  });

  test("anything that is not a <time> is null", () => {
    expect(parseTime("")).toBeNull();
    expect(parseTime("450")).toBeNull();
    expect(parseTime("ease")).toBeNull();
  });
});

// A computed style is only ever asked for custom properties.
const style = (vars: Record<string, string>) => ({
  getPropertyValue: (name: string) => vars[name] ?? "",
});

describe("readScrollTiming", () => {
  test("null when neither a duration nor a speed is set — the native scroll stays", () => {
    expect(readScrollTiming(style({}))).toBeNull();
    expect(readScrollTiming(style({ "--thread-scroll-easing": "linear" }))).toBeNull();
  });

  test("the longhands", () => {
    const timing = readScrollTiming(
      style({ "--thread-scroll-duration": "450ms", "--thread-scroll-easing": "ease-out" }),
    );
    expect(timing).toEqual({ duration: 450, speed: null, easing: "ease-out" });
  });

  test("a duration alone eases with the default", () => {
    expect(readScrollTiming(style({ "--thread-scroll-duration": "1s" }))?.easing).toBe("ease");
  });

  test("the shorthand takes a Motion spring() string as-is", () => {
    const spring = "900ms linear(0, 0.0444, 0.1487, 1)";
    expect(readScrollTiming(style({ "--thread-scroll": spring }))).toEqual({
      duration: 900,
      speed: null,
      easing: "linear(0, 0.0444, 0.1487, 1)",
    });
  });

  test("longhands override the shorthand", () => {
    const timing = readScrollTiming(
      style({ "--thread-scroll": "900ms ease-in", "--thread-scroll-duration": "200ms" }),
    );
    expect(timing).toEqual({ duration: 200, speed: null, easing: "ease-in" });
  });

  test("none opts back out, over any longhand", () => {
    const optedOut = style({ "--thread-scroll": "none", "--thread-scroll-duration": "0ms" });
    expect(readScrollTiming(optedOut)).toBeNull();
  });

  test("a non-positive speed is ignored", () => {
    expect(readScrollTiming(style({ "--thread-scroll-speed": "0" }))).toBeNull();
  });
});

describe("resolveDuration", () => {
  test("a fixed duration ignores the distance", () => {
    expect(resolveDuration({ duration: 450, speed: null, easing: "ease" }, 5000)).toBe(450);
  });

  test("a speed paces the duration by distance, in either direction", () => {
    const paced = { duration: null, speed: 2000, easing: "ease" };
    expect(resolveDuration(paced, 500)).toBe(250);
    expect(resolveDuration(paced, -500)).toBe(250);
  });

  test("with a speed, the duration is the cap", () => {
    const capped = { duration: 300, speed: 1000, easing: "ease" };
    expect(resolveDuration(capped, 100)).toBe(100);
    expect(resolveDuration(capped, 5000)).toBe(300);
  });
});

describe("alignedScrollTop", () => {
  // A 400px-tall scroller at viewport top 100, scrolled to 1000 of 3000. Rows
  // are placed by their offset inside the scroll content.
  const setup = (rowTop: number, rowHeight: number, rowStyle = "", scrollerStyle = "") => {
    const scroller = document.createElement("div");
    const row = document.createElement("div");
    scroller.setAttribute("style", scrollerStyle);
    row.setAttribute("style", rowStyle);
    scroller.append(row);
    document.body.append(scroller);
    for (const [key, value] of Object.entries({
      scrollTop: 1000,
      scrollHeight: 3000,
      clientHeight: 400,
      clientTop: 0,
    })) {
      Object.defineProperty(scroller, key, { value, configurable: true });
    }
    scroller.getBoundingClientRect = () => ({ top: 100 }) as DOMRect;
    row.getBoundingClientRect = () =>
      ({ top: 100 + rowTop - 1000, bottom: 100 + rowTop - 1000 + rowHeight }) as DOMRect;
    return { scroller, row };
  };

  test("start puts the row's top at the scroller's top", () => {
    const { scroller, row } = setup(1800, 100);
    expect(alignedScrollTop(scroller, row, "start")).toBe(1800);
  });

  test("end puts the row's bottom at the scroller's bottom", () => {
    const { scroller, row } = setup(1800, 100);
    expect(alignedScrollTop(scroller, row, "end")).toBe(1500);
  });

  test("center centers it", () => {
    const { scroller, row } = setup(1800, 100);
    expect(alignedScrollTop(scroller, row, "center")).toBe(1650);
  });

  test("honors the row's scroll-margin and the scroller's scroll-padding", () => {
    const { scroller, row } = setup(
      1800,
      100,
      "scroll-margin-top: 16px",
      "scroll-padding-top: 8px",
    );
    expect(alignedScrollTop(scroller, row, "start")).toBe(1776);
  });

  test("resolves a percentage scroll-padding against the viewport's height", () => {
    // 400px viewport: 10% = 40px at the top, 25% = 100px at the bottom.
    const padded = "scroll-padding-top: 10%; scroll-padding-bottom: 25%";
    expect(alignedScrollTop(...pair(setup(1800, 100, "", padded)), "start")).toBe(1760);
    // The row's bottom (1900) at the band's bottom: 1900 - 40 - (400 - 40 - 100).
    expect(alignedScrollTop(...pair(setup(1800, 100, "", padded)), "end")).toBe(1600);
  });

  test("clamps to the scroll range", () => {
    expect(alignedScrollTop(...pair(setup(2900, 100)), "start")).toBe(2600);
    expect(alignedScrollTop(...pair(setup(50, 100)), "end")).toBe(0);
  });

  describe("nearest", () => {
    test("a row in view stays put", () => {
      const { scroller, row } = setup(1100, 100);
      expect(alignedScrollTop(scroller, row, "nearest")).toBe(1000);
    });

    test("a row above comes in at the top, a row below at the bottom", () => {
      expect(alignedScrollTop(...pair(setup(600, 100)), "nearest")).toBe(600);
      expect(alignedScrollTop(...pair(setup(1800, 100)), "nearest")).toBe(1500);
    });

    test("a row taller than the view, below it, brings in its top", () => {
      expect(alignedScrollTop(...pair(setup(1200, 600)), "nearest")).toBe(1200);
    });

    test("a row overflowing both edges stays put", () => {
      expect(alignedScrollTop(...pair(setup(900, 600)), "nearest")).toBe(1000);
    });
  });
});

const pair = ({ scroller, row }: { scroller: HTMLElement; row: HTMLElement }) =>
  [scroller, row] as const;

// happy-dom has no Web Animations, and its frames run on timers. The animator
// only needs a timing effect's progress and play state, and a frame queue we
// can step by hand.
const fake = {
  progress: 0,
  finished: false,
  rejectedEasing: null as string | null,
  lastEasing: "",
  frames: [] as FrameRequestCallback[],
};

const useFakeTiming = () => {
  const saved = {
    Animation: globalThis.Animation,
    KeyframeEffect: globalThis.KeyframeEffect,
    requestAnimationFrame: globalThis.requestAnimationFrame,
    cancelAnimationFrame: globalThis.cancelAnimationFrame,
  };

  beforeEach(() => {
    Object.assign(fake, { progress: 0, finished: false, rejectedEasing: null, frames: [] });
    globalThis.KeyframeEffect = class {
      constructor(_target: unknown, _keyframes: unknown, options: KeyframeEffectOptions) {
        if (options.easing === fake.rejectedEasing) throw new TypeError("invalid easing");
        fake.lastEasing = options.easing ?? "";
      }
      getComputedTiming = () => ({ progress: fake.progress });
    } as unknown as typeof KeyframeEffect;
    globalThis.Animation = class {
      constructor(public effect: KeyframeEffect) {}
      get playState() {
        return fake.finished ? "finished" : "running";
      }
      play() {}
      cancel() {}
    } as unknown as typeof Animation;
    globalThis.requestAnimationFrame = (callback) => fake.frames.push(callback);
    globalThis.cancelAnimationFrame = (handle) => {
      fake.frames[handle - 1] = () => {};
    };
  });

  afterEach(() => Object.assign(globalThis, saved));
};

const nextFrame = (at: number, done = false) => {
  fake.progress = at;
  fake.finished = done;
  fake.frames.at(-1)?.(0);
};

describe("animateScroll", () => {
  useFakeTiming();

  const scroller = (top: number) => {
    const writes: number[] = [];
    const el = {
      scrollTop: top,
      scrollTo: ({ top: next }: ScrollToOptions) => writes.push(next ?? 0),
    } as unknown as HTMLElement;
    return { el, writes };
  };

  test("moves by the eased progress and finishes on the target", () => {
    const { el, writes } = scroller(0);
    let doneCount = 0;
    animateScroll(el, {
      duration: 400,
      easing: "ease-out",
      getTarget: () => 1000,
      onFinish: () => doneCount++,
    });
    nextFrame(0.5);
    nextFrame(0.9);
    nextFrame(1, true);
    expect(writes).toEqual([500, 900, 1000]);
    expect(doneCount).toBe(1);
  });

  test("re-reads the target every frame, so growth mid-flight is tracked", () => {
    const { el, writes } = scroller(0);
    let target = 1000;
    animateScroll(el, { duration: 400, easing: "linear", getTarget: () => target, onFinish() {} });
    nextFrame(0.5);
    target = 1400;
    nextFrame(1, true);
    expect(writes).toEqual([500, 1400]);
  });

  test("cancel stops it where it is, without finishing", () => {
    const { el, writes } = scroller(0);
    let doneCount = 0;
    const cancel = animateScroll(el, {
      duration: 400,
      easing: "linear",
      getTarget: () => 1000,
      onFinish: () => doneCount++,
    });
    nextFrame(0.25);
    cancel();
    nextFrame(1, true);
    expect(writes).toEqual([250]);
    expect(doneCount).toBe(0);
  });

  test("an easing the engine rejects falls back to the default", () => {
    fake.rejectedEasing = "not-an-easing";
    const { el } = scroller(0);
    animateScroll(el, {
      duration: 400,
      easing: "not-an-easing",
      getTarget: () => 1,
      onFinish() {},
    });
    expect(fake.lastEasing).toBe("ease");
  });
});

// The thread end to end: what the styled layer sees (data-scrolling) and what
// stops an animation. happy-dom has no layout, so every destination is 0 —
// these assert the lifecycle, not positions.
describe("Thread scripted scroll", () => {
  useFakeTiming();

  const ScrollButtons = () => {
    const { scrollToBottom, scrollToMessage } = useThread();
    return (
      <>
        <button type="button" onClick={() => scrollToBottom()}>
          Latest
        </button>
        <button type="button" onClick={() => scrollToMessage("greeting")}>
          Greeting
        </button>
      </>
    );
  };

  const renderThread = (timing: Record<string, string>) => {
    const { container } = render(
      <Thread.Root autoScroll="off" style={timing as CSSProperties}>
        <Thread.Viewport>
          <Thread.Content>
            <p data-message-id="greeting">Hello</p>
          </Thread.Content>
        </Thread.Viewport>
        <ScrollButtons />
      </Thread.Root>,
    );
    const root = container.querySelector("[data-thread-root]") as HTMLElement;
    const scroller = container.querySelector("[data-thread-scroller]") as HTMLElement;
    const row = container.querySelector("[data-message-id]") as HTMLElement;
    return { root, scroller, row };
  };

  const clickLatest = () => act(() => screen.getByRole("button", { name: "Latest" }).click());

  test("stamps data-scrolling with the kind while the animation runs", () => {
    const { root } = renderThread({ "--thread-scroll-duration": "400ms" });
    clickLatest();
    expect(root.getAttribute("data-scrolling")).toBe("bottom");
    nextFrame(0.5);
    expect(root.getAttribute("data-scrolling")).toBe("bottom");
    nextFrame(1, true);
    expect(root.hasAttribute("data-scrolling")).toBe(false);
  });

  test("a wheel in either direction interrupts it", () => {
    const { root, scroller } = renderThread({ "--thread-scroll-duration": "400ms" });
    clickLatest();
    fireEvent.wheel(scroller, { deltaY: 40 });
    expect(root.hasAttribute("data-scrolling")).toBe(false);
  });

  test("a scroll key on the focused viewport interrupts it", () => {
    const { root, scroller } = renderThread({ "--thread-scroll-duration": "400ms" });
    clickLatest();
    fireEvent.keyDown(scroller, { key: "PageDown" });
    expect(root.hasAttribute("data-scrolling")).toBe(false);
  });

  test("without a timing, the scroll stays native and nothing is stamped", () => {
    const { root, scroller } = renderThread({});
    const calls: ScrollToOptions[] = [];
    scroller.scrollTo = ((options: ScrollToOptions) => calls.push(options)) as never;
    clickLatest();
    expect(root.hasAttribute("data-scrolling")).toBe(false);
    expect(fake.frames).toHaveLength(0);
    expect(calls.at(-1)?.behavior).toBe("smooth");
  });

  test("a zero duration jumps instantly", () => {
    const { root, scroller } = renderThread({ "--thread-scroll-duration": "0ms" });
    const calls: ScrollToOptions[] = [];
    scroller.scrollTo = ((options: ScrollToOptions) => calls.push(options)) as never;
    clickLatest();
    expect(root.hasAttribute("data-scrolling")).toBe(false);
    expect(calls.at(-1)?.behavior).toBe("instant");
  });

  test("a touch interrupts it", () => {
    const { root, scroller } = renderThread({ "--thread-scroll-duration": "400ms" });
    clickLatest();
    fireEvent.touchStart(scroller, { touches: [{ clientY: 100 }] });
    expect(root.hasAttribute("data-scrolling")).toBe(false);
  });

  test("a press on the scroller itself — its scrollbar — interrupts it; a press on a row does not", () => {
    const { root, scroller, row } = renderThread({ "--thread-scroll-duration": "400ms" });
    clickLatest();
    fireEvent.pointerDown(row);
    expect(root.getAttribute("data-scrolling")).toBe("bottom");
    fireEvent.pointerDown(scroller);
    expect(root.hasAttribute("data-scrolling")).toBe(false);
  });

  test("none keeps the native scroll, over any longhand", () => {
    const { root, scroller } = renderThread({
      "--thread-scroll": "none",
      "--thread-scroll-duration": "400ms",
    });
    const calls: ScrollToOptions[] = [];
    scroller.scrollTo = ((options: ScrollToOptions) => calls.push(options)) as never;
    clickLatest();
    expect(root.hasAttribute("data-scrolling")).toBe(false);
    expect(calls.at(-1)?.behavior).toBe("smooth");
  });

  test("under reduced motion nothing animates, whatever the timing", () => {
    const matchMedia = window.matchMedia;
    window.matchMedia = ((query: string) => ({ matches: query.includes("reduce") })) as never;
    try {
      const { root, scroller } = renderThread({ "--thread-scroll-duration": "400ms" });
      const calls: ScrollToOptions[] = [];
      scroller.scrollTo = ((options: ScrollToOptions) => calls.push(options)) as never;
      clickLatest();
      expect(root.hasAttribute("data-scrolling")).toBe(false);
      expect(calls.at(-1)?.behavior).toBe("instant");
    } finally {
      window.matchMedia = matchMedia;
    }
  });

  // CHAT-40: scrollIntoView scrolls every scrollable ancestor, so a thread
  // embedded in a page moved the page too. The native path now computes the
  // row's position itself and scrolls only the thread's own viewport.
  const placeRow = (scroller: HTMLElement, row: HTMLElement) => {
    scroller.getBoundingClientRect = () => ({ top: 100, bottom: 400, height: 300 }) as DOMRect;
    Object.defineProperty(scroller, "clientHeight", { value: 300, configurable: true });
    Object.defineProperty(scroller, "scrollHeight", { value: 1000, configurable: true });
    row.getBoundingClientRect = () => ({ top: 500, bottom: 540, height: 40 }) as DOMRect;
    let intoView = false;
    row.scrollIntoView = (() => {
      intoView = true;
    }) as never;
    const calls: ScrollToOptions[] = [];
    scroller.scrollTo = ((options: ScrollToOptions) => calls.push(options)) as never;
    return { calls, usedScrollIntoView: () => intoView };
  };

  test("scrollToMessage without a timing scrolls only the thread's viewport", () => {
    const { scroller, row } = renderThread({});
    const { calls, usedScrollIntoView } = placeRow(scroller, row);
    act(() => screen.getByRole("button", { name: "Greeting" }).click());
    expect(usedScrollIntoView()).toBe(false);
    // align "start": the row's top (400px into the content) at the viewport's top.
    expect(calls.at(-1)).toEqual({ top: 400, behavior: "smooth" });
  });

  test("scrollToMessage under reduced motion jumps, still only within the thread", () => {
    const matchMedia = window.matchMedia;
    window.matchMedia = ((query: string) => ({ matches: query.includes("reduce") })) as never;
    try {
      const { scroller, row } = renderThread({});
      const { calls, usedScrollIntoView } = placeRow(scroller, row);
      act(() => screen.getByRole("button", { name: "Greeting" }).click());
      expect(usedScrollIntoView()).toBe(false);
      expect(calls.at(-1)).toEqual({ top: 400, behavior: "instant" });
    } finally {
      window.matchMedia = matchMedia;
    }
  });

  test("scrollToMessage with a timing animates, stamped as a message scroll", () => {
    const { root } = renderThread({ "--thread-scroll-duration": "400ms" });
    act(() => screen.getByRole("button", { name: "Greeting" }).click());
    expect(root.getAttribute("data-scrolling")).toBe("message");
  });
});
