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
    className="group/shell relative flex h-80 w-full overflow-hidden rounded-xl border border-[#f0f0f0] bg-[#fafafa] [--shell-sidebar-width:220px] dark:border-[#262626] dark:bg-[#111111]"
  >
    <div data-slot="shell-gutter" className="w-(--shell-sidebar-width) shrink-0" />

    <Shell.Sidebar className="absolute inset-y-0 left-0 z-10 flex w-(--shell-sidebar-width) min-w-[180px] max-w-[300px] flex-col bg-[#fafafa] dark:bg-[#111111]">
      <div className="flex h-11 shrink-0 items-center px-4 font-medium text-[#1a1a1a] text-sm dark:text-[#fcfcfc]">
        Workspace
      </div>
      <div className="flex flex-col gap-0.5 px-2">
        {["Overview", "Inbox", "Projects"].map((label) => (
          <div
            key={label}
            className="flex h-8 items-center rounded-md px-2 text-[#686868] text-sm dark:text-[#9b9b9b]"
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
          "focus-visible:-outline-offset-2 focus-visible:outline-2 focus-visible:outline-[#1a1a1a] dark:focus-visible:outline-[#fcfcfc]",
        ].join(" ")}
      >
        <span
          aria-hidden="true"
          className={[
            "pointer-events-none absolute left-1/2 h-9 w-1 -translate-x-1/2 -translate-y-1/2 rounded-full",
            "bg-[#b0b0b0] dark:bg-[#5c5c5c]",
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
      <div className="flex min-h-0 flex-1 items-center justify-center rounded-xl border border-[#f0f0f0] bg-white px-4 text-center text-[#686868] text-sm dark:border-[#262626] dark:bg-[#181818] dark:text-[#9b9b9b]">
        Move the pointer onto the sidebar's right edge. The handle appears and follows it.
      </div>
    </Shell.Viewport>
  </Shell.Root>
);
