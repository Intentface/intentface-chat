"use client";

import { Shell } from "@intentface/chat/shell";
import { ChevronDown, PanelLeft } from "@keyline-icons/react";
import { Logo } from "./logo";
import { SidebarNav } from "./sidebar-nav";

/*
 * A shell the way it is meant to be used: a sidebar that collapses, floats out
 * on hover and drags wider, holding a real Nav, beside the content card it
 * shares the screen with.
 *
 * The load-bearing arrangement is the one that is easy to get wrong. The
 * sidebar is taken *out of flow* and a plain spacer — the gutter — holds its
 * place. That is what lets all three states be one element morphing between
 * three positions: flush while expanded, off-canvas while collapsed, floating
 * just inside the edge while the hotspot holds it out. A sidebar left in flow can only animate
 * its own width, so it can never float over the content, and the hotspot has
 * nothing to slide across.
 *
 * `absolute` inside a `relative` root because this is a box on a docs page; a
 * real app shell uses `fixed` against the window.
 */
export const Basic = () => (
  <Shell.Root
    defaultOpen
    className="group/shell relative flex h-128 w-full overflow-hidden rounded-xl bg-[#f5f5f6] shadow-[0_0_0_1px_rgb(0_0_0/0.075),0_1px_2px_rgb(0_0_0/0.06),0_4px_8px_-2px_rgb(0_0_0/0.05)] [--shell-sidebar-width:224px] dark:bg-[#131315] dark:shadow-[0_0_0_1px_rgb(0_0_0/0.16),0_1px_2px_rgb(0_0_0/0.1)] dark:after:pointer-events-none dark:after:absolute dark:after:inset-0 dark:after:z-50 dark:after:rounded-[inherit] dark:after:shadow-[inset_0_1px_0_rgb(255_255_255/0.05),inset_0_0_0_1px_rgb(255_255_255/0.06)]"
  >
    {/* Not rendering this is how you opt out of hotspot. */}
    <Shell.Hotspot className="absolute inset-y-0 left-0 z-20 hidden w-5 data-[state=collapsed]:block" />

    {/* The gutter. Not a part of the package: a div reading the property the
        grip writes, animating to zero while the panel slides away. */}
    <div
      data-slot="shell-gutter"
      className="w-(--shell-sidebar-width) shrink-0 transition-[width] duration-150 ease-linear group-data-resizing/shell:transition-none group-data-[state=collapsed]/shell:w-0 motion-reduce:transition-none"
    />

    <Shell.Sidebar
      className={[
        // min/max-width are the entire drag range — the handle reads them off computed style.
        // pt-2 matches the viewport's padding, so the sidebar header sits on the
        // same lines as the card header and the first row lands on its border.
        "absolute inset-y-0 left-0 z-10 flex w-(--shell-sidebar-width) min-w-[184px] max-w-[320px] flex-col overflow-hidden pt-2",
        // Always opaque: the content card passes beneath the panel while the two
        // animate, so a transparent expanded state would show it through.
        "bg-[#f5f5f6] dark:bg-[#131315]",
        "transition-[left,top,bottom,padding-top,background-color,border-radius,box-shadow] duration-150 ease-linear",
        // The card geometry is baked into the whole collapsed state. Off-canvas
        // it is invisible, so the hotspot animates `left` alone — the panel never
        // changes height mid-slide. Only expand/collapse morphs card ↔ flat.
        // The card's own inset supplies the 8px, so the padding goes — and
        // because both transition, the header stays put while the edge moves.
        "data-[state=collapsed]:-left-(--shell-sidebar-width) data-[state=collapsed]:inset-y-2 data-[state=collapsed]:rounded-lg data-[state=collapsed]:pt-0",
        "data-[state=collapsed]:bg-white data-[state=collapsed]:not-data-[hotspot]:shadow-[0_0_0_1px_rgb(0_0_0/0.075),0_1px_2px_rgb(0_0_0/0.06),0_4px_8px_-2px_rgb(0_0_0/0.05)]",
        "dark:data-[state=collapsed]:bg-zinc-900 dark:data-[state=collapsed]:not-data-[hotspot]:shadow-[inset_0_1px_0_rgb(255_255_255/0.05),inset_0_0_0_1px_rgb(255_255_255/0.06),0_0_0_1px_rgb(0_0_0/0.16),0_1px_2px_rgb(0_0_0/0.1)]",
        // Floated out by the hotspot it lifts to overlay elevation.
        "data-[state=collapsed]:data-[hotspot]:left-2 data-[hotspot]:shadow-[0_0_0_1px_rgb(0_0_0/0.075),0_1px_2px_rgb(0_0_0/0.06),0_12px_32px_-8px_rgb(0_0_0/0.16)]",
        "dark:data-[hotspot]:shadow-[inset_0_1px_0_rgb(255_255_255/0.06),inset_0_0_0_1px_rgb(255_255_255/0.07),0_0_0_1px_rgb(0_0_0/0.16),0_12px_32px_-8px_rgb(0_0_0/0.4)]",
        "motion-reduce:transition-none",
      ].join(" ")}
    >
      {/* Same columns as a nav row: the 20px logo tile centres on a row's 16px
          icon (Nav px-2 + row px-2, less 2px), and gap-1.5 lands the title
          where a row's label starts. */}
      <div className="flex h-11 shrink-0 items-center gap-1.5 pr-2 pl-3.5">
        <span className="grid size-5 shrink-0 place-items-center rounded-[5px] bg-[#0169cc] bg-linear-to-b from-[oklch(57.2%_0.166_253.2)] to-[oklch(52.9%_0.173_255)] shadow-[inset_0_1px_0_rgb(255_255_255/0.28),inset_0_-2px_3px_oklch(30%_0.12_258/0.35),0_0_0_1px_oklch(46.5%_0.146_254.8),0_1px_2px_rgb(1_105_204/0.35)]">
          <Logo />
        </span>
        <span className="min-w-0 flex-1 truncate font-semibold text-[13px] text-zinc-900 tracking-[-0.01em] dark:text-zinc-100">
          @intentface/chat
        </span>
        <Shell.Trigger
          aria-label="Collapse sidebar"
          className="grid size-7 shrink-0 cursor-pointer select-none place-items-center rounded-full text-zinc-400 transition-colors hover:bg-zinc-950/5 hover:text-zinc-900 focus-visible:outline-2 focus-visible:outline-[#0169cc]/60 focus-visible:outline-offset-2 dark:text-zinc-500 dark:hover:bg-white/8 dark:hover:text-zinc-100"
        >
          <PanelLeft className="size-[15px]" />
        </Shell.Trigger>
      </div>

      {/* The nav is its own primitive — see the Nav page for the tree, the
          rail and the keyboard model. Here it is just what a sidebar holds. */}
      <SidebarNav />
    </Shell.Sidebar>

    {/* A sibling of the sidebar, not a child: the sidebar clips its overflow
        for the collapsed card, so a handle hung off its edge would be cut in
        half. Positioned instead against the viewport's left edge — the 6px hit
        area straddles the content card's border, so the hairline it reveals
        lands exactly on the line already drawn there. */}
    <Shell.Grip
      aria-label="Resize sidebar"
      className={[
        "absolute inset-y-0 left-[calc(var(--shell-sidebar-width)+8px)] z-20 w-1.5 -translate-x-1/2 cursor-col-resize select-none",
        "before:absolute before:inset-y-0 before:left-1/2 before:w-px before:-translate-x-1/2 before:bg-transparent before:transition-colors before:duration-100",
        // Masked rather than gradient-filled, so the hairline keeps a single
        // background-color to transition while both ends fall away. The stops
        // are pixels, not percentages: the fade has to land fully transparent
        // 16px in — the card's 8px inset plus its 8px radius, where the corner
        // arc leaves the straight edge — and that distance is fixed, not a
        // share of the height.
        "before:[mask-image:linear-gradient(to_bottom,transparent_16px,black_72px,black_calc(100%-72px),transparent_calc(100%-16px))]",
        "hover:before:bg-[#0169cc] data-[resizing]:before:bg-[#0169cc] dark:hover:before:bg-[#4c9bea] dark:data-[resizing]:before:bg-[#4c9bea]",
        "focus-visible:-outline-offset-2 focus-visible:outline-2 focus-visible:outline-[#0169cc]/60",
        "data-[state=collapsed]:hidden",
      ].join(" ")}
    />

    {/* The gutter only exists while the sidebar does: collapsed, the card runs
        edge to edge. */}
    <Shell.Viewport className="flex min-w-0 flex-1 flex-col p-2">
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg bg-white shadow-[0_0_0_1px_rgb(0_0_0/0.075),0_1px_2px_rgb(0_0_0/0.06),0_4px_8px_-2px_rgb(0_0_0/0.05)] dark:bg-zinc-900 dark:shadow-[inset_0_1px_0_rgb(255_255_255/0.05),inset_0_0_0_1px_rgb(255_255_255/0.06),0_0_0_1px_rgb(0_0_0/0.16),0_1px_2px_rgb(0_0_0/0.1)]">
        <div className="flex h-11 shrink-0 items-center gap-1 border-zinc-950/6 border-b px-3 dark:border-white/6">
          <span className="px-1 text-[13px] text-zinc-500 dark:text-zinc-400">Docs</span>
          <ChevronDown className="size-3 -rotate-90 text-zinc-400 dark:text-zinc-500" />
          <span className="px-1 font-medium text-[13px] text-zinc-900 dark:text-zinc-100">
            Overview
          </span>
        </div>
        <article className="min-h-0 flex-1 overflow-auto px-8 py-8">
          <h1 className="mb-5 font-semibold text-base text-zinc-900 tracking-tight dark:text-zinc-100">
            Overview
          </h1>
          <p className="mb-4 text-sm text-zinc-700 leading-[1.7] dark:text-zinc-300">
            Collapse the sidebar with the button in its header, then rest the pointer against the
            left edge to float it back out as a card. Drag the divider to resize it, or nudge it
            with the arrow keys once the handle has focus.
          </p>
          <p className="text-sm text-zinc-700 leading-[1.7] dark:text-zinc-300">
            The width and the range it may be dragged through are this stylesheet&apos;s; the
            primitive only measures and reports back.
          </p>
        </article>
      </div>
    </Shell.Viewport>
  </Shell.Root>
);
