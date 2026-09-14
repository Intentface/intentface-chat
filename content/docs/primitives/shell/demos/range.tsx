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
    className="group/shell relative flex h-80 w-full overflow-hidden rounded-xl border border-[#f0f0f0] bg-[#fafafa] [--shell-sidebar-width:200px] dark:border-[#262626] dark:bg-[#111111]"
  >
    <div data-slot="shell-gutter" className="w-(--shell-sidebar-width) shrink-0" />

    <Shell.Sidebar className="absolute inset-y-0 left-0 z-10 flex w-(--shell-sidebar-width) min-w-[160px] max-w-[260px] flex-col bg-[#fafafa] dark:bg-[#111111]">
      <div className="flex h-11 shrink-0 items-center px-4 font-medium text-[#1a1a1a] text-sm dark:text-[#fcfcfc]">
        Drag the divider
      </div>

      <WidthReadout />

      {/* A 6px hit area with a hairline inside, so the target is comfortable
          while the divider stays thin. */}
      <Shell.Grip
        aria-label="Resize sidebar"
        className="-right-[3px] absolute inset-y-0 w-1.5 cursor-col-resize select-none before:absolute before:inset-y-0 before:left-1/2 before:w-px before:-translate-x-1/2 before:bg-[#e4e4e4] before:transition-colors hover:before:bg-[#1a1a1a] data-[resizing]:before:bg-[#1a1a1a] dark:before:bg-[#2d2d2d] dark:hover:before:bg-[#fcfcfc] dark:data-[resizing]:before:bg-[#fcfcfc]"
      />
    </Shell.Sidebar>

    <Shell.Viewport className="flex min-w-0 flex-1 flex-col p-2">
      <div className="flex min-h-0 flex-1 items-center justify-center rounded-xl border border-[#f0f0f0] bg-white px-4 text-center text-[#686868] text-sm dark:border-[#262626] dark:bg-[#181818] dark:text-[#9b9b9b]">
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
    <div className="px-4 text-[#949494] text-sm tabular-nums dark:text-[#6f6f6f]">
      {width === null ? "measuring…" : `${Math.round(width)}px`}
    </div>
  );
};
