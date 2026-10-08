"use client";

import { Shell, type ShellStore, useShell, useShellStore } from "@intentface/chat/shell";
import { useState } from "react";

/*
 * Starts collapsed, so the hotspot is the first thing there is to try: rest the
 * pointer on the strip at the left edge and the sidebar floats out as a card.
 * Two ways back: the header control, reached through the hotspot once the
 * sidebar is away, and the button under the shell, which drives the same state
 * from outside the tree through a `Shell.createStore()` handle.
 *
 * `Shell.Hotspot` is the part; `hotspot` is the state it produces. The hotspot is
 * the hit area you hover, and while the pointer rests there the sidebar and
 * everything else in the shell carry `data-hotspot`.
 *
 * The card geometry is baked into the whole collapsed state rather than into
 * `data-hotspot` alone. Off-canvas the card is invisible anyway, so the hotspot then
 * animates `left` and nothing else — no vertical movement, no radius appearing
 * mid-slide. Only expand and collapse morph card to flat.
 */
export const HotspotDemo = () => {
  const [store] = useState(() => Shell.createStore());

  return (
    <div className="flex w-full flex-col gap-3">
      <Shell.Root
        store={store}
        className="group/shell relative flex h-80 w-full overflow-hidden rounded-xl bg-[#f5f5f6] shadow-[0_0_0_1px_rgb(0_0_0/0.075),0_1px_2px_rgb(0_0_0/0.06),0_4px_8px_-2px_rgb(0_0_0/0.05)] [--shell-sidebar-width:200px] dark:bg-[#131315] dark:shadow-[0_0_0_1px_rgb(0_0_0/0.16),0_1px_2px_rgb(0_0_0/0.1)] dark:after:pointer-events-none dark:after:absolute dark:after:inset-0 dark:after:z-50 dark:after:rounded-[inherit] dark:after:shadow-[inset_0_1px_0_rgb(255_255_255/0.05),inset_0_0_0_1px_rgb(255_255_255/0.06)]"
      >
        {/* Invisible in a real app. Tinted here so there is something to aim at,
        since the whole point is a hit area you cannot otherwise see.

        It sits *under* the sidebar, so the card tucks the strip away as it
        slides out. Nothing is lost by that: `Shell.Sidebar` carries its own
        hold handler, so the hotspot survives the pointer moving from the strip
        onto the card even though the strip is no longer beneath it.

        Not rendering this part at all is how you opt out of hotspot. */}
        <Shell.Hotspot
          className={[
            "absolute inset-y-2 left-2 z-0 w-7 rounded-lg border border-[#0169cc]/60 border-dashed bg-[#0169cc]/5 dark:border-[#4c9bea]/50 dark:bg-[#4c9bea]/10",
            // Faded rather than toggled with `display`, so it arrives and leaves
            // with the sidebar instead of popping. `pointer-events` still switches
            // outright: a transparent strip that swallowed clicks would be worse
            // than a visible one.
            "pointer-events-none opacity-0 transition-opacity duration-150 ease-linear",
            "data-[state=collapsed]:pointer-events-auto data-[state=collapsed]:opacity-100",
          ].join(" ")}
        />

        <div
          data-slot="shell-gutter"
          className="w-(--shell-sidebar-width) shrink-0 transition-[width] duration-150 ease-linear group-data-[state=collapsed]/shell:w-0"
        />

        <Shell.Sidebar
          className={[
            "absolute inset-y-0 left-0 z-10 flex w-(--shell-sidebar-width) flex-col overflow-hidden pt-2",
            // Always opaque: the content card passes beneath the panel while the
            // two animate, so a transparent expanded state would show it through.
            "bg-[#f5f5f6] dark:bg-[#131315]",
            "transition-[left,top,bottom,padding-top,background-color,border-radius,box-shadow] duration-150 ease-linear",
            // The collapsed state carries the card. The hotspoted state moves it.
            "data-[state=collapsed]:-left-(--shell-sidebar-width) data-[state=collapsed]:inset-y-2 data-[state=collapsed]:rounded-lg data-[state=collapsed]:pt-0",
            "data-[state=collapsed]:bg-white data-[state=collapsed]:not-data-[hotspot]:shadow-[0_0_0_1px_rgb(0_0_0/0.075),0_1px_2px_rgb(0_0_0/0.06),0_4px_8px_-2px_rgb(0_0_0/0.05)]",
            "dark:data-[state=collapsed]:bg-zinc-900 dark:data-[state=collapsed]:not-data-[hotspot]:shadow-[inset_0_1px_0_rgb(255_255_255/0.05),inset_0_0_0_1px_rgb(255_255_255/0.06),0_0_0_1px_rgb(0_0_0/0.16),0_1px_2px_rgb(0_0_0/0.1)]",
            // Floated out by the hotspot it lifts to overlay elevation.
            "data-[state=collapsed]:data-[hotspot]:left-2 data-[hotspot]:shadow-[0_0_0_1px_rgb(0_0_0/0.075),0_1px_2px_rgb(0_0_0/0.06),0_12px_32px_-8px_rgb(0_0_0/0.16)]",
            "dark:data-[hotspot]:shadow-[inset_0_1px_0_rgb(255_255_255/0.06),inset_0_0_0_1px_rgb(255_255_255/0.07),0_0_0_1px_rgb(0_0_0/0.16),0_12px_32px_-8px_rgb(0_0_0/0.4)]",
          ].join(" ")}
        >
          <div className="flex h-11 shrink-0 items-center justify-between gap-2 px-4">
            <span className="font-medium text-[13px] text-zinc-900 dark:text-zinc-100">
              Workspace
            </span>
            <TriggerLabel />
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
        </Shell.Sidebar>

        <Shell.Viewport className="flex min-w-0 flex-1 flex-col p-2">
          <div className="flex min-h-0 flex-1 items-center justify-center rounded-lg bg-white shadow-[0_0_0_1px_rgb(0_0_0/0.075),0_1px_2px_rgb(0_0_0/0.06),0_4px_8px_-2px_rgb(0_0_0/0.05)] px-4 dark:bg-zinc-900 dark:shadow-[inset_0_1px_0_rgb(255_255_255/0.05),inset_0_0_0_1px_rgb(255_255_255/0.06),0_0_0_1px_rgb(0_0_0/0.16),0_1px_2px_rgb(0_0_0/0.1)]">
            {/* Capped: a line of prose spanning the whole viewport is unreadable,
            and this one runs behind the strip at the left edge. */}
            <p className="max-w-56 text-balance text-center text-[13px] text-zinc-500 dark:text-zinc-400">
              Rest the pointer on the strip at the left edge.
            </p>
          </div>
        </Shell.Viewport>
      </Shell.Root>

      {/* Outside Shell.Root — it reaches the state through the store handle. */}
      <ExternalTrigger store={store} />
    </div>
  );
};

const ExternalTrigger = ({ store }: { store: ShellStore }) => {
  const open = useShellStore(store, (shell) => shell.open);

  return (
    <div className="flex justify-center">
      <button
        type="button"
        onClick={() => store.getSnapshot().toggle()}
        className="flex h-8 cursor-pointer items-center rounded-full bg-white bg-linear-to-b from-white to-[#fdfdfd] shadow-[inset_0_1px_0_#fff,0_0_0_1px_rgb(0_0_0/0.075),0_1px_2px_rgb(0_0_0/0.07),0_2px_6px_-2px_rgb(0_0_0/0.05)] px-4 font-medium text-[13px] text-zinc-900 hover:from-[#fafafa] hover:to-[#f6f6f6] focus-visible:outline-2 focus-visible:outline-[#0169cc]/60 focus-visible:outline-offset-2 dark:bg-[#2d2d30] dark:from-[#313134] dark:to-[#2a2a2d] dark:shadow-[inset_0_1px_0_rgb(255_255_255/0.1),inset_0_0_0_1px_rgb(255_255_255/0.05),0_0_0_1px_rgb(0_0_0/0.16),0_1px_2px_rgb(0_0_0/0.1)] dark:hover:from-[#38383b] dark:hover:to-[#313134] dark:text-zinc-100"
      >
        {open ? "Collapse" : "Expand"}
      </button>
    </div>
  );
};

/**
 * The label has to name the action, not the part. While the hotspot is holding the sidebar out
 * it is collapsed but visible, and pressing the trigger pins it open rather
 * than closing it — so "Hide" would be wrong in exactly the state this demo
 * spends most of its time in.
 */
const TriggerLabel = () => {
  const open = useShell((shell) => shell.open);

  return (
    <Shell.Trigger
      aria-label={open ? "Collapse sidebar" : "Pin sidebar open"}
      className="-mr-2 flex h-6 cursor-pointer items-center rounded-full px-2 font-medium text-xs text-zinc-500 transition-colors hover:bg-zinc-950/5 hover:text-zinc-900 focus-visible:outline-2 focus-visible:outline-[#0169cc]/60 focus-visible:outline-offset-2 dark:text-zinc-400 dark:hover:bg-white/8 dark:hover:text-zinc-100"
    >
      {open ? "Hide" : "Pin"}
    </Shell.Trigger>
  );
};
