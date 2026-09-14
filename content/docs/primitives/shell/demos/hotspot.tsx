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
        className="group/shell relative flex h-80 w-full overflow-hidden rounded-xl border border-[#f0f0f0] bg-[#fafafa] [--shell-sidebar-width:200px] dark:border-[#262626] dark:bg-[#111111]"
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
            "absolute inset-y-2 left-2 z-0 w-7 rounded-xl border border-[#c9d8f0] border-dashed bg-[#eaf1fb] dark:border-[#2b3a52] dark:bg-[#16202e]",
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
            "bg-[#fafafa] dark:bg-[#111111]",
            "border border-transparent transition-[left,top,bottom,padding-top,background-color,border-color,border-radius,box-shadow] duration-150 ease-linear",
            // The collapsed state carries the card. The hotspoted state moves it.
            "data-[state=collapsed]:-left-(--shell-sidebar-width) data-[state=collapsed]:inset-y-2 data-[state=collapsed]:rounded-xl data-[state=collapsed]:pt-0",
            "data-[state=collapsed]:bg-white data-[state=collapsed]:not-data-[hotspot]:border-[#f0f0f0]",
            "dark:data-[state=collapsed]:bg-[#181818] dark:data-[state=collapsed]:not-data-[hotspot]:border-[#262626]",
            "data-[state=collapsed]:data-[hotspot]:left-2 data-[hotspot]:shadow-[0_6px_20px_rgba(0,0,0,0.07)] dark:data-[hotspot]:shadow-[0_6px_20px_rgba(0,0,0,0.4)]",
          ].join(" ")}
        >
          <div className="flex h-11 shrink-0 items-center justify-between gap-2 px-4">
            <span className="font-medium text-[#1a1a1a] text-sm dark:text-[#fcfcfc]">
              Workspace
            </span>
            <TriggerLabel />
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
        </Shell.Sidebar>

        <Shell.Viewport className="flex min-w-0 flex-1 flex-col p-2">
          <div className="flex min-h-0 flex-1 items-center justify-center rounded-xl border border-[#f0f0f0] bg-white px-4 dark:border-[#262626] dark:bg-[#181818]">
            {/* Capped: a line of prose spanning the whole viewport is unreadable,
            and this one runs behind the strip at the left edge. */}
            <p className="max-w-56 text-balance text-center text-[#686868] text-sm dark:text-[#9b9b9b]">
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
        className="flex h-8 cursor-pointer items-center rounded-full border border-[#e4e4e4] bg-white px-4 font-medium text-[#1a1a1a] text-sm transition-colors hover:bg-[#f4f4f4] focus-visible:-outline-offset-2 focus-visible:outline-2 focus-visible:outline-[#1a1a1a] dark:border-[#2d2d2d] dark:bg-[#181818] dark:text-[#fcfcfc] dark:hover:bg-[#232323] dark:focus-visible:outline-[#fcfcfc]"
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
      className="cursor-pointer rounded text-[#686868] text-xs transition-colors hover:text-[#1a1a1a] focus-visible:-outline-offset-2 focus-visible:outline-2 focus-visible:outline-[#1a1a1a] dark:text-[#9b9b9b] dark:hover:text-[#fcfcfc] dark:focus-visible:outline-[#fcfcfc]"
    >
      {open ? "Hide" : "Pin"}
    </Shell.Trigger>
  );
};
