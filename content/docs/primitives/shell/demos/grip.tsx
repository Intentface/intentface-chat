"use client";

import { Shell } from "@intentface/chat/shell";

/*
 * Styling the grip: an iOS-style pill that fades in on hover and rides the
 * pointer vertically.
 *
 * The grip is a bare div with a role and some keys — no shadow DOM, no
 * built-in affordance — so the whole appearance is yours. Nothing is drawn at
 * rest; the pill is a child, faded in on hover and positioned from `--grip-y`.
 *
 * The pointer position is written straight to a custom property rather than
 * held in React state. A pointermove that re-rendered would re-render the
 * whole shell on every frame of a drag, and there is nothing here React needs
 * to know about — only a number CSS reads.
 *
 * `onPointerMove` is safe to pass: the primitive merges handlers rather than
 * replacing them, so the drag it runs on the same event still happens.
 */
export const Grip = () => (
  <Shell.Root
    defaultOpen
    className="group/shell relative flex h-80 w-full overflow-hidden rounded-xl bg-[#f5f5f6] shadow-[0_0_0_1px_rgb(0_0_0/0.075),0_1px_2px_rgb(0_0_0/0.06),0_4px_8px_-2px_rgb(0_0_0/0.05)] [--shell-sidebar-width:220px] dark:bg-[#131315] dark:shadow-[0_0_0_1px_rgb(0_0_0/0.16),0_1px_2px_rgb(0_0_0/0.1)] dark:after:pointer-events-none dark:after:absolute dark:after:inset-0 dark:after:z-50 dark:after:rounded-[inherit] dark:after:shadow-[inset_0_1px_0_rgb(255_255_255/0.05),inset_0_0_0_1px_rgb(255_255_255/0.06)]"
  >
    <div data-slot="shell-gutter" className="w-(--shell-sidebar-width) shrink-0" />

    <Shell.Sidebar className="absolute inset-y-0 left-0 z-10 flex w-(--shell-sidebar-width) min-w-[180px] max-w-[300px] flex-col bg-[#f5f5f6] dark:bg-[#131315]">
      <div className="flex h-11 shrink-0 items-center px-4 font-medium text-[13px] text-zinc-900 dark:text-zinc-100">
        Workspace
      </div>
      <div className="flex flex-col gap-0.5 px-2">
        {/* The first row stands in for the current page. */}
        {["Overview", "Inbox", "Projects"].map((label) => (
          <div
            key={label}
            className="flex h-[30px] items-center rounded-md px-2 font-medium text-[13px] text-zinc-700 transition-colors hover:bg-zinc-950/5 hover:text-zinc-900 first:bg-white first:bg-linear-to-b first:from-white first:to-[#fdfdfd] first:text-zinc-900 first:shadow-[inset_0_1px_0_#fff,0_0_0_1px_rgb(0_0_0/0.075),0_1px_2px_rgb(0_0_0/0.07),0_2px_6px_-2px_rgb(0_0_0/0.05)] dark:text-zinc-300 dark:hover:bg-white/8 dark:hover:text-zinc-100 dark:first:bg-[#2d2d30] dark:first:from-[#29292c] dark:first:to-[#242427] dark:first:text-zinc-100 dark:first:shadow-[inset_0_1px_0_rgb(255_255_255/0.1),inset_0_0_0_1px_rgb(255_255_255/0.05),0_0_0_1px_rgb(0_0_0/0.16),0_1px_2px_rgb(0_0_0/0.1)]"
          >
            {label}
          </div>
        ))}
      </div>

      <Shell.Grip
        aria-label="Resize sidebar"
        // `offsetY` is already relative to the grip's own box, so this costs no
        // layout read — unlike getBoundingClientRect on every move.
        onPointerMove={(event) => {
          event.currentTarget.style.setProperty("--grip-y", `${event.nativeEvent.offsetY}px`);
        }}
        className={[
          // A 20px hit area straddling the sidebar's edge. Wide enough for a
          // fingertip, while the 4px pill drawn inside it stays thin — which
          // is the point of separating the target from the affordance.
          "group/grip -right-2.5 absolute inset-y-0 w-5 cursor-col-resize select-none",
          "focus-visible:-outline-offset-2 focus-visible:outline-2 focus-visible:outline-[#0169cc]/60",
        ].join(" ")}
      >
        <span
          aria-hidden="true"
          className={[
            "pointer-events-none absolute left-1/2 h-9 w-1 -translate-x-1/2 -translate-y-1/2 rounded-full",
            "bg-zinc-400 dark:bg-zinc-600",
            // Clamped by half its own height at each end, so it never hangs
            // out of the track. Centred at rest, so a keyboard user focusing
            // the grip finds it somewhere sensible rather than at the top.
            "top-[clamp(18px,var(--grip-y,50%),calc(100%-18px))]",
            // No transition on `top`: a handle that lags the pointer reads as
            // broken rather than smooth. Only the fade is animated.
            "opacity-0 transition-opacity duration-150",
            "group-hover/grip:opacity-100 group-focus-visible/grip:opacity-100 group-data-[resizing]/grip:opacity-100",
          ].join(" ")}
        />
      </Shell.Grip>
    </Shell.Sidebar>

    <Shell.Viewport className="flex min-w-0 flex-1 flex-col p-2">
      <div className="flex min-h-0 flex-1 items-center justify-center rounded-lg bg-white shadow-[0_0_0_1px_rgb(0_0_0/0.075),0_1px_2px_rgb(0_0_0/0.06),0_4px_8px_-2px_rgb(0_0_0/0.05)] px-4 text-center text-[13px] text-zinc-500 dark:bg-zinc-900 dark:shadow-[inset_0_1px_0_rgb(255_255_255/0.05),inset_0_0_0_1px_rgb(255_255_255/0.06),0_0_0_1px_rgb(0_0_0/0.16),0_1px_2px_rgb(0_0_0/0.1)] dark:text-zinc-400">
        Move the pointer onto the sidebar's right edge. The handle appears and follows it.
      </div>
    </Shell.Viewport>
  </Shell.Root>
);
