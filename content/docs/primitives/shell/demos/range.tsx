"use client";

import { Shell, useShell } from "@intentface/chat/shell";

/*
 * The drag range, made obvious by making it small: 160px to 260px, so both
 * stops are a short drag away.
 *
 * Nothing here configures the range. `min-width` and `max-width` on the
 * sidebar are the whole configuration — the grip reads them off computed style
 * when a drag starts, clamps against them, and writes the result back as
 * `--shell-sidebar-width`. The readout is the measurement coming back out, and
 * it is the same number `aria-valuenow` announces.
 */
export const Range = () => (
  <Shell.Root
    defaultOpen
    className="group/shell relative flex h-80 w-full overflow-hidden rounded-xl bg-[#f5f5f6] shadow-[0_0_0_1px_rgb(0_0_0/0.075),0_1px_2px_rgb(0_0_0/0.06),0_4px_8px_-2px_rgb(0_0_0/0.05)] [--shell-sidebar-width:200px] dark:bg-[#131315] dark:shadow-[0_0_0_1px_rgb(0_0_0/0.16),0_1px_2px_rgb(0_0_0/0.1)] dark:after:pointer-events-none dark:after:absolute dark:after:inset-0 dark:after:z-50 dark:after:rounded-[inherit] dark:after:shadow-[inset_0_1px_0_rgb(255_255_255/0.05),inset_0_0_0_1px_rgb(255_255_255/0.06)]"
  >
    <div data-slot="shell-gutter" className="w-(--shell-sidebar-width) shrink-0" />

    <Shell.Sidebar className="absolute inset-y-0 left-0 z-10 flex w-(--shell-sidebar-width) min-w-[160px] max-w-[260px] flex-col bg-[#f5f5f6] dark:bg-[#131315]">
      <div className="flex h-11 shrink-0 items-center px-4 font-medium text-[13px] text-zinc-900 dark:text-zinc-100">
        Drag the divider
      </div>

      <WidthReadout />

      {/* A 6px hit area with a hairline inside, so the target is comfortable
          while the divider stays thin. */}
      <Shell.Grip
        aria-label="Resize sidebar"
        className="-right-[3px] absolute inset-y-0 w-1.5 cursor-col-resize select-none before:absolute before:inset-y-0 before:left-1/2 before:w-px before:-translate-x-1/2 before:bg-zinc-950/10 before:transition-colors hover:before:bg-[#0169cc] data-[resizing]:before:bg-[#0169cc] focus-visible:-outline-offset-2 focus-visible:outline-2 focus-visible:outline-[#0169cc]/60 dark:before:bg-white/10 dark:hover:before:bg-[#4c9bea] dark:data-[resizing]:before:bg-[#4c9bea]"
      />
    </Shell.Sidebar>

    <Shell.Viewport className="flex min-w-0 flex-1 flex-col p-2">
      <div className="flex min-h-0 flex-1 items-center justify-center rounded-lg bg-white shadow-[0_0_0_1px_rgb(0_0_0/0.075),0_1px_2px_rgb(0_0_0/0.06),0_4px_8px_-2px_rgb(0_0_0/0.05)] px-4 text-center text-[13px] text-zinc-500 dark:bg-zinc-900 dark:shadow-[inset_0_1px_0_rgb(255_255_255/0.05),inset_0_0_0_1px_rgb(255_255_255/0.06),0_0_0_1px_rgb(0_0_0/0.16),0_1px_2px_rgb(0_0_0/0.1)] dark:text-zinc-400">
        The sidebar stops at 160px and 260px. The browser clamps it, not the primitive.
      </div>
    </Shell.Viewport>
  </Shell.Root>
);

/**
 * `width` is what the browser settled on after clamping, not what the drag
 * asked for — which is why it stops moving at the bounds even while the
 * pointer keeps going.
 */
const WidthReadout = () => {
  const width = useShell((shell) => shell.width);

  return (
    <div className="px-4 font-mono text-xs text-zinc-400 tabular-nums dark:text-zinc-500">
      {width === null ? "measuring…" : `${Math.round(width)}px`}
    </div>
  );
};
