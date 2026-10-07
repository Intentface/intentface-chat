"use client";

import { Steps } from "@intentface/chat/steps";
import { Check, ChevronDown, LoaderCircle, X } from "@keyline-icons/react";
import { useEffect, useRef, useState } from "react";

const ROWS = ["Read the request", "Searched the web", "Checked the cache", "Wrote the answer"];

/*
 * `status` is an opaque string. The package resolves it — own prop, then
 * inherited from the enclosing item, then "complete" — and reflects it as
 * `data-status`. It never decides what the set is.
 *
 * So "error" below is not a feature; it is a string this demo invented and then
 * styled — here with nothing but its glyph. Run it and watch each step arrive
 * active and settle as complete, with one failing on the way.
 *
 * The entrance is plain CSS: each step's row grows from 0fr to 1fr, then its icon
 * fades in, then its label, all from @starting-style (Tailwind's `starting:` variant).
 */

// A step stays active this long before it settles, and the next one arrives
// after a short pause.
const ACTIVE_MS = 1400;
const PAUSE_MS = 400;
export const Status = () => {
  // Steps that have appeared, and steps that have settled.
  const [appeared, setAppeared] = useState(ROWS.length);
  const [settled, setSettled] = useState(ROWS.length);
  // Bumped per run so every row remounts and plays its entrance again.
  const [run, setRun] = useState(0);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  const start = () => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
    setRun((current) => current + 1);
    setAppeared(0);
    setSettled(0);
    ROWS.forEach((_, index) => {
      const start = index * (ACTIVE_MS + PAUSE_MS);
      timers.current.push(setTimeout(() => setAppeared(index + 1), start));
      timers.current.push(setTimeout(() => setSettled(index + 1), start + ACTIVE_MS));
    });
  };

  const statusFor = (index: number) => {
    if (index >= settled) return "active";
    return index === 2 ? "error" : "complete";
  };

  const running = settled < ROWS.length;
  const visible = ROWS.slice(0, appeared);

  return (
    <div className="flex w-full max-w-lg flex-col gap-4">
      {/* Reserves the finished list's height (28px header + four 28px steps with
          8px of rail between them), so the button below stays put while steps
          arrive or the list collapses. */}
      <Steps.Root className="min-h-[164px] w-full">
        <Steps.Item defaultOpen>
          <Steps.Trigger className="group/steps-trigger flex h-7 w-full cursor-pointer items-center gap-2.5 rounded-md text-[13px] text-zinc-500 transition-colors hover:text-zinc-900 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-[#0169cc]/60 dark:text-zinc-400 dark:hover:text-zinc-100">
            <span className="font-medium">{running ? "Working…" : "Worked for 3 seconds"}</span>
            <ChevronDown className="size-[15px] shrink-0 -rotate-90 transition-transform group-data-open/steps-trigger:rotate-0" />
          </Steps.Trigger>

          {/* Collapsing animates the height from --panel-height, which the panel
              publishes while it transitions; [&>*]:shrink-0 keeps the measure honest. */}
          <Steps.Panel className="flex h-(--panel-height) flex-col overflow-hidden transition-[height] duration-200 ease-out data-ending-style:h-0 data-starting-style:h-0 [&>*]:shrink-0">
            {visible.map((row, index) => {
              const status = statusFor(index);
              return (
                // The row grows first (0–300ms), then the icon fades in (300–600ms),
                // then the label (600–900ms).
                <div
                  key={`${run}-${row}`}
                  className="grid grid-rows-[1fr] transition-[grid-template-rows] duration-300 ease-out starting:grid-rows-[0fr]"
                >
                  <div className="flex min-h-0 flex-col overflow-hidden">
                    {/* A piece of rail joins this step to the one above. */}
                    {index > 0 && (
                      <span
                        aria-hidden="true"
                        className="ml-[7px] block h-2 w-px shrink-0 bg-zinc-950/10 dark:bg-white/10"
                      />
                    )}
                    <div className="flex h-7 shrink-0 items-center gap-2.5">
                      {/* Every rule here keys off data-status. The package supplies the
                          attribute and takes no view on what the values mean. */}
                      <Steps.Icon
                        status={status}
                        className="grid size-[15px] shrink-0 place-items-center text-zinc-500 transition-opacity delay-300 duration-300 ease-out starting:opacity-0 data-[status=active]:text-zinc-900 dark:text-zinc-400 dark:data-[status=active]:text-zinc-100"
                      >
                        {status === "complete" ? (
                          <Check className="size-[15px]" />
                        ) : status === "error" ? (
                          <X className="size-[15px]" />
                        ) : (
                          <LoaderCircle className="size-[15px] animate-spin" />
                        )}
                      </Steps.Icon>

                      <Steps.Label
                        status={status}
                        className="text-[13px] text-zinc-700 transition-[opacity,translate] delay-[600ms] duration-300 ease-out starting:-translate-x-2 starting:opacity-0 data-[status=active]:font-medium data-[status=active]:text-zinc-900 data-[status=error]:text-zinc-500 dark:text-zinc-300 dark:data-[status=active]:text-zinc-100 dark:data-[status=error]:text-zinc-400"
                      >
                        {row}
                      </Steps.Label>

                      {/* Visually hidden, and the only thing that speaks the status:
                          the icon is aria-hidden and colour announces nothing. */}
                      <Steps.Status status={status} />
                    </div>
                  </div>
                </div>
              );
            })}
          </Steps.Panel>
        </Steps.Item>
      </Steps.Root>

      <div className="flex justify-center">
        <button
          type="button"
          onClick={start}
          disabled={running}
          className="h-8 cursor-pointer rounded-full bg-white bg-linear-to-b from-white to-[#fdfdfd] px-3.5 font-medium text-[13px] text-zinc-900 shadow-[inset_0_1px_0_#fff,0_0_0_1px_rgb(0_0_0/0.075),0_1px_2px_rgb(0_0_0/0.07),0_2px_6px_-2px_rgb(0_0_0/0.05)] hover:from-[#fafafa] hover:to-[#f6f6f6] focus-visible:outline-2 focus-visible:outline-[#0169cc]/60 focus-visible:outline-offset-2 disabled:cursor-default disabled:opacity-40 dark:bg-[#2d2d30] dark:from-[#313134] dark:to-[#2a2a2d] dark:text-zinc-100 dark:shadow-[inset_0_1px_0_rgb(255_255_255/0.1),inset_0_0_0_1px_rgb(255_255_255/0.05),0_0_0_1px_rgb(0_0_0/0.16),0_1px_2px_rgb(0_0_0/0.1)] dark:hover:from-[#38383b] dark:hover:to-[#313134]"
        >
          {running ? "Running…" : "Run again"}
        </button>
      </div>
    </div>
  );
};
