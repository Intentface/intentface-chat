"use client";

import { Steps } from "@intentface/chat/steps";
import { IconCheck, IconCircle, IconLoader2, IconX } from "@tabler/icons-react";
import { type ComponentProps, useEffect, useRef, useState } from "react";

const ROWS = ["Read the request", "Searched the web", "Checked the cache", "Wrote the answer"];

/*
 * `status` is an opaque string. The package resolves it — own prop, then
 * inherited from the enclosing item, then "complete" — and reflects it as
 * `data-status`. It never decides what the set is.
 *
 * So "error" and "skipped" below are not features; they are strings this demo
 * invented and then styled. Run it and watch each row move through pending,
 * active and complete, with one failing on the way.
 */
export const Status = () => {
  const [reached, setReached] = useState(ROWS.length);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  const run = () => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
    setReached(0);
    ROWS.forEach((_, index) => {
      timers.current.push(setTimeout(() => setReached(index + 1), (index + 1) * 800));
    });
  };

  const statusFor = (index: number) => {
    if (index === 2 && reached > 2) return "error";
    if (index < reached) return "complete";
    if (index === reached) return "active";
    return "pending";
  };

  const running = reached < ROWS.length;

  return (
    <div className="flex w-full max-w-lg flex-col gap-3">
      <Steps.Root className="rounded-xl border border-[#f0f0f0] bg-white p-3 dark:border-[#262626] dark:bg-[#181818]">
        <Steps.Item defaultOpen>
          <Steps.Trigger className="flex w-full cursor-pointer items-center gap-2 rounded text-[#1a1a1a] text-sm dark:text-[#fcfcfc]">
            <span className="font-medium">{running ? "Working…" : "Worked for 3 seconds"}</span>
          </Steps.Trigger>

          <Steps.Panel className="mt-2 flex flex-col gap-1.5 pl-1">
            {ROWS.map((row, index) => {
              const status = statusFor(index);
              return (
                <div key={row} className="flex items-center gap-2">
                  <Steps.Icon status={status} className={iconClass}>
                    {status === "complete" ? (
                      <IconCheck className="size-3.5" />
                    ) : status === "error" ? (
                      <IconX className="size-3.5" />
                    ) : status === "active" ? (
                      <IconLoader2 />
                    ) : (
                      <IconCircle className="size-3.5" />
                    )}
                  </Steps.Icon>

                  <Steps.Label status={status} className={labelClass}>
                    {row}
                  </Steps.Label>

                  {/* Visually hidden, and the only thing that speaks the status:
                      the icon is aria-hidden and colour announces nothing. */}
                  <Steps.Status status={status} />
                </div>
              );
            })}
          </Steps.Panel>
        </Steps.Item>
      </Steps.Root>

      <div className="flex justify-center">
        <button
          type="button"
          onClick={run}
          disabled={running}
          className="h-8 cursor-pointer rounded-full border border-[#e4e4e4] bg-white px-4 font-medium text-[#1a1a1a] text-sm transition-colors hover:bg-[#f4f4f4] disabled:cursor-default disabled:opacity-40 dark:border-[#2d2d2d] dark:bg-[#181818] dark:text-[#fcfcfc] dark:hover:bg-[#232323]"
        >
          {running ? "Running…" : "Run again"}
        </button>
      </div>
    </div>
  );
};

// Every rule here keys off data-status. The package supplies the attribute and
// takes no view on what the values mean.
const iconClass =
  "grid size-4 shrink-0 place-items-center text-[#949494] data-[status=complete]:text-emerald-600 data-[status=active]:text-[#1a1a1a] data-[status=error]:text-red-600 dark:text-[#6f6f6f] dark:data-[status=complete]:text-emerald-400 dark:data-[status=active]:text-[#fcfcfc] dark:data-[status=error]:text-red-400";

const labelClass =
  "text-sm text-[#949494] data-[status=complete]:text-[#686868] data-[status=active]:text-[#1a1a1a] data-[status=active]:font-medium data-[status=error]:text-red-600 dark:text-[#6f6f6f] dark:data-[status=complete]:text-[#9b9b9b] dark:data-[status=active]:text-[#fcfcfc] dark:data-[status=error]:text-red-400";

const _glyph = (props: ComponentProps<"svg">) => ({
  viewBox: "0 0 16 16",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.6,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  className: "size-3.5",
  "aria-hidden": true,
  ...props,
});
