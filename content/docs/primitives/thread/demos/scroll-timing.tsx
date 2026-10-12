"use client";

import { Composer, type ComposerSubmitData } from "@intentface/chat/composer";
import { Message } from "@intentface/chat/message";
import { Thread } from "@intentface/chat/thread";
import { ArrowUp } from "@keyline-icons/react";
import { spring } from "motion";
import { type CSSProperties, useEffect, useRef, useState } from "react";

type Exchange = { id: string; question: string; answer: string };

const SEED: Exchange[] = [
  {
    id: "1",
    question: "Why does my list re-render on every keystroke?",
    answer:
      "Because the parent holding the input state re-renders, and every child re-renders with it unless something stops the cascade.",
  },
];

// Each preset is plain CSS on the root. Static timings are Tailwind classes;
// the spring is computed by Motion, so it goes through `style`.
const PRESETS = {
  native: { className: "", style: {}, caption: "No timing set: the browser's own smooth scroll." },
  snappy: {
    className: "[--thread-scroll:250ms_cubic-bezier(0.2,0.8,0.2,1)]",
    style: {},
    caption: "A short ease-out for every scroll.",
  },
  spring: {
    className: "",
    // bounce 0: an overshoot past the bottom is clamped by the scroller.
    style: { "--thread-scroll": String(spring(0.6, 0)) },
    caption: "Motion's spring(), as a linear() easing.",
  },
  paced: {
    className: "[--thread-scroll-speed:1200] [--thread-scroll-duration:700ms]",
    style: {},
    caption: "1200px/s, capped at 700ms: short scrolls are quick.",
  },
  slow: {
    className:
      "[--thread-scroll:200ms_ease-out] data-[scrolling=land]:[--thread-scroll:5s_ease-in-out]",
    style: {},
    caption: "A 5s land: the reply streams in while it is still landing.",
  },
} satisfies Record<string, { className: string; style: object; caption: string }>;

type Preset = keyof typeof PRESETS;

const PROMPT = "Is memoising the list enough?";

const REPLY =
  "Memoisation compares props, so the comparison itself has to be cheaper than the render you are avoiding. That is usually true for a list and rarely true for a single row. Measure first: the profiler shows which renders are worth skipping, and which ones were never the problem. Then memoise the expensive subtree, keep its props stable, and leave the cheap rows alone.";

/*
 * Scroll timing, set from CSS.
 *
 * With no timing, smooth scrolls are the browser's own. Set `--thread-scroll`
 * (or its longhands, or a speed) on the root and the thread animates them
 * itself. While it does, the root carries `data-scrolling` naming why — so a
 * selector can time the landing differently from the follow, as the slow
 * preset does. Scroll by hand at any point and the animation stops.
 */
export const ScrollTiming = () => {
  const [preset, setPreset] = useState<Preset>("spring");
  const [exchanges, setExchanges] = useState<Exchange[]>(SEED);
  const [draft, setDraft] = useState(PROMPT);
  const [streaming, setStreaming] = useState(false);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  const stopStream = () => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
    setStreaming(false);
  };

  const handleSubmit = (data: ComposerSubmitData) => {
    if (data.kind !== "message" || !data.text.trim() || streaming) return;
    stopStream();

    const id = `${Date.now()}`;
    setExchanges((current) => [...current, { id, question: data.text, answer: "" }]);
    setStreaming(true);

    const words = REPLY.split(" ");
    words.forEach((_, index) => {
      timers.current.push(
        setTimeout(
          () => {
            setExchanges((current) =>
              current.map((exchange) =>
                exchange.id === id
                  ? { ...exchange, answer: words.slice(0, index + 1).join(" ") }
                  : exchange,
              ),
            );
          },
          300 + index * 50,
        ),
      );
    });
    timers.current.push(
      setTimeout(
        () => {
          setStreaming(false);
          setDraft(PROMPT);
        },
        300 + words.length * 50,
      ),
    );
  };

  const { className, style, caption } = PRESETS[preset];

  return (
    <div className="flex w-full max-w-xl flex-col gap-3">
      <div className="flex flex-wrap items-center gap-0.5 self-center rounded-full bg-zinc-100 p-0.5 dark:bg-[#131315]">
        {(Object.keys(PRESETS) as Preset[]).map((candidate) => (
          <button
            key={candidate}
            type="button"
            onClick={() => {
              stopStream();
              setPreset(candidate);
              setExchanges(SEED);
              setDraft(PROMPT);
            }}
            className={[
              "h-7 cursor-pointer rounded-full px-3 font-medium font-mono text-[13px] transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0169cc]/60",
              candidate === preset
                ? `${RAISED} text-zinc-900 dark:text-zinc-100`
                : "text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100",
            ].join(" ")}
          >
            {candidate}
          </button>
        ))}
      </div>

      <div className="h-[26rem] w-full overflow-hidden rounded-xl bg-white shadow-[0_0_0_1px_rgb(0_0_0/0.075),0_1px_2px_rgb(0_0_0/0.06),0_4px_8px_-2px_rgb(0_0_0/0.05)] dark:bg-zinc-900 dark:shadow-[inset_0_1px_0_rgb(255_255_255/0.05),inset_0_0_0_1px_rgb(255_255_255/0.06),0_0_0_1px_rgb(0_0_0/0.16),0_1px_2px_rgb(0_0_0/0.1)]">
        <Thread.Root
          key={preset}
          autoScroll="follow"
          style={style as CSSProperties}
          className={`relative flex h-full w-full overflow-hidden [--thread-overlay-top-height:1rem] ${className}`}
        >
          <Thread.Overlay
            direction="top"
            className="inset-x-0 top-0 z-1 h-(--thread-overlay-top-height) bg-linear-to-b from-white to-transparent dark:from-zinc-900"
          />
          <Thread.Viewport className="h-full w-full overflow-x-hidden overflow-y-auto outline-none [overflow-anchor:auto]">
            <div className="relative flex min-h-full w-full flex-col pt-(--thread-overlay-top-height) pb-(--thread-overlay-bottom-height)">
              <Thread.Content className="flex min-h-full w-full flex-col gap-5 px-4 [&>*:last-child]:min-h-(--thread-turn-min-height,0px)">
                {exchanges.map((exchange, index) => (
                  <Message.Turn key={exchange.id} className="flex flex-col gap-5">
                    {/* biome-ignore lint/a11y/useValidAriaRole: `role` is the message's author, not an ARIA role */}
                    <Message.Root role="user" className="group flex w-full flex-col items-end">
                      <Message.Text className="max-w-[80%] rounded-[20px] bg-white px-3.5 py-1.5 text-sm text-zinc-900 leading-6 shadow-[0_0_0_1px_rgb(0_0_0/0.08),0_1px_2px_rgb(0_0_0/0.04)] dark:bg-zinc-800 dark:text-zinc-100 dark:shadow-[inset_0_1px_0_rgb(255_255_255/0.05),inset_0_0_0_1px_rgb(255_255_255/0.06),0_0_0_1px_rgb(0_0_0/0.16)]">
                        {exchange.question}
                      </Message.Text>
                    </Message.Root>
                    {exchange.answer && (
                      // biome-ignore lint/a11y/useValidAriaRole: `role` is the message's author, not an ARIA role
                      <Message.Root
                        role="assistant"
                        isLast={index === exchanges.length - 1}
                        className="group flex w-full flex-col"
                      >
                        <Message.Text className="text-sm text-zinc-700 leading-6 dark:text-zinc-300">
                          {exchange.answer}
                        </Message.Text>
                      </Message.Root>
                    )}
                  </Message.Turn>
                ))}
              </Thread.Content>
            </div>
          </Thread.Viewport>
          <Thread.Composer className="absolute inset-x-0 bottom-0 z-2 w-full">
            <div className="flex w-full flex-col px-4 pb-4">
              <Composer.Root onSubmit={handleSubmit} className="flex w-full flex-col">
                <Composer.Container className="cursor-text rounded-xl bg-white p-1 shadow-[0_0_0_1px_rgb(0_0_0/0.08),0_1px_2px_-1px_rgb(0_0_0/0.08),0_6px_16px_-6px_rgb(0_0_0/0.1)] dark:bg-zinc-800 dark:shadow-[inset_0_1px_0_rgb(255_255_255/0.06),inset_0_0_0_1px_rgb(255_255_255/0.07),0_0_0_1px_rgb(0_0_0/0.2),0_1px_2px_rgb(0_0_0/0.12),0_6px_16px_-6px_rgb(0_0_0/0.22)]">
                  <Composer.Textarea
                    value={draft}
                    onValueChange={setDraft}
                    className="max-h-32 min-h-10 overflow-y-auto px-2.5 pt-2.5 text-sm text-zinc-900 dark:text-zinc-100 **:data-composer-editor:w-full **:data-composer-editor:max-w-none **:data-composer-editor:leading-6 [&_[data-composer-editor]:focus]:outline-none"
                  >
                    <Composer.Placeholder
                      placeholder="Ask a follow-up…"
                      className="text-zinc-400 leading-6 dark:text-zinc-500"
                    />
                  </Composer.Textarea>
                  <Composer.Actions className="flex h-11 items-center justify-end px-2.5">
                    <Composer.Submit
                      disabled={streaming}
                      className="flex size-7 cursor-pointer items-center justify-center rounded-full bg-[#0169cc] bg-linear-to-b from-[oklch(57.2%_0.166_253.2)] to-[oklch(52.9%_0.173_255)] text-white shadow-[inset_0_1px_0_rgb(255_255_255/0.28),0_0_0_1px_oklch(46.5%_0.146_254.8),0_1px_2px_rgb(1_105_204/0.35)] transition-opacity focus-visible:outline-2 focus-visible:outline-[#0169cc]/60 focus-visible:outline-offset-2 disabled:cursor-default disabled:opacity-40"
                    >
                      <ArrowUp className="size-[15px]" />
                    </Composer.Submit>
                  </Composer.Actions>
                </Composer.Container>
              </Composer.Root>
            </div>
          </Thread.Composer>
        </Thread.Root>
      </div>

      <p className="text-center text-xs text-zinc-500 dark:text-zinc-400">{caption}</p>
    </div>
  );
};

// The raised surface of the selected preset.
const RAISED =
  "bg-white bg-linear-to-b from-white to-[#fdfdfd] shadow-[inset_0_1px_0_#fff,0_0_0_1px_rgb(0_0_0/0.075),0_1px_2px_rgb(0_0_0/0.07),0_2px_6px_-2px_rgb(0_0_0/0.05)] dark:bg-[#2d2d30] dark:from-[#313134] dark:to-[#2a2a2d] dark:shadow-[inset_0_1px_0_rgb(255_255_255/0.1),inset_0_0_0_1px_rgb(255_255_255/0.05),0_0_0_1px_rgb(0_0_0/0.16),0_1px_2px_rgb(0_0_0/0.1)]";
