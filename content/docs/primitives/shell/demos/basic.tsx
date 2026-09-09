"use client";

import { Nav } from "@intentface/chat/nav";
import { Shell } from "@intentface/chat/shell";
import type { ComponentProps } from "react";

/*
 * A shell the way it is meant to be used: a sidebar that collapses, floats out
 * on hover and drags wider, holding a real Nav, beside the content card it
 * shares the screen with.
 *
 * The load-bearing arrangement is the one that is easy to get wrong. The
 * sidebar is taken *out of flow* and a plain spacer — the gutter — holds its
 * place. That is what lets all three states be one element morphing between
 * three positions: flush while expanded, off-canvas while collapsed, floating
 * just inside the edge while peeking. A sidebar left in flow can only animate
 * its own width, so it can never float over the content, and the peek has
 * nothing to slide across.
 *
 * `absolute` inside a `relative` root because this is a box on a docs page; a
 * real app shell uses `fixed` against the window.
 */
export const Basic = () => (
  <Shell.Root
    defaultOpen
    className="group/shell relative flex h-128 w-full overflow-hidden rounded-xl border border-[#f0f0f0] bg-[#fafafa] [--shell-sidebar-width:224px] dark:border-[#262626] dark:bg-[#111111]"
  >
    {/* Not rendering this is how you opt out of hover-peek. */}
    <Shell.PeekZone className="absolute inset-y-0 left-0 z-20 hidden w-5 data-[state=collapsed]:block" />

    {/* The gutter. Not a part of the package: a div reading the property the
        resize handle writes, animating to zero while the panel slides away. */}
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
        "bg-[#fafafa] dark:bg-[#111111]",
        "border border-transparent transition-[left,top,bottom,padding-top,background-color,border-color,border-radius,box-shadow] duration-150 ease-linear",
        // The card geometry is baked into the whole collapsed state. Off-canvas
        // it is invisible, so the peek animates `left` alone — the panel never
        // changes height mid-slide. Only expand/collapse morphs card ↔ flat.
        // The card's own inset supplies the 8px, so the padding goes — and
        // because both transition, the header stays put while the edge moves.
        "data-[state=collapsed]:-left-(--shell-sidebar-width) data-[state=collapsed]:inset-y-2 data-[state=collapsed]:rounded-xl data-[state=collapsed]:pt-0",
        "data-[state=collapsed]:bg-white data-[state=collapsed]:not-data-[peek]:border-[#f0f0f0]",
        "dark:data-[state=collapsed]:bg-[#181818] dark:data-[state=collapsed]:not-data-[peek]:border-[#262626]",
        "data-[state=collapsed]:data-[peek]:left-2 data-[peek]:smooth-shadow-ring-lg",
        "motion-reduce:transition-none",
      ].join(" ")}
    >
      {/* Same columns as a nav row: pl-4 puts the badge where a row's icon
          sits (Nav px-2 + row px-2), the badge is icon-sized, and gap-2 lands
          the title where a row's label starts. */}
      <div className="flex h-11 shrink-0 items-center gap-2 pr-2 pl-4">
        <span className="grid size-4 shrink-0 place-items-center rounded-[4px] bg-[#1a1a1a] font-semibold text-[9px] text-white dark:bg-[#fcfcfc] dark:text-[#111111]">
          ui
        </span>
        <span className="min-w-0 flex-1 truncate font-medium text-[#1a1a1a] text-sm dark:text-[#fcfcfc]">
          @intentface/chat
        </span>
        <Shell.Trigger aria-label="Collapse sidebar" className={iconButtonClass}>
          <PanelLeftIcon />
        </Shell.Trigger>
      </div>

      {/* The nav is its own primitive — see the Nav page for the tree, the
          rail and the keyboard model. Here it is just what a sidebar holds. */}
      <Nav.Root
        aria-label="Main"
        guide="none"
        defaultExpanded={["workspace"]}
        render={<nav />}
        className="flex min-h-0 flex-1 flex-col gap-0.5 overflow-auto px-2 pb-2"
      >
        <Nav.List className="flex flex-col gap-0.5">
          <Nav.Item value="overview" active className={rowClass}>
            <Nav.Icon>
              <HomeIcon />
            </Nav.Icon>
            <Nav.Label className="min-w-0 truncate">Overview</Nav.Label>
          </Nav.Item>
          <Nav.Item value="inbox" className={rowClass}>
            <Nav.Icon>
              <InboxIcon />
            </Nav.Icon>
            <Nav.Label className="min-w-0 truncate">Inbox</Nav.Label>
          </Nav.Item>

          <Nav.Group value="workspace" className="mt-3">
            <Nav.Trigger className={rowClass}>
              <Nav.Label className="min-w-0 truncate">Workspace</Nav.Label>
              <ChevronIcon className="ml-auto !size-3 text-[#949494] transition-transform group-data-[closed]/row:-rotate-90" />
            </Nav.Trigger>
            <Nav.List className="flex flex-col gap-0.5">
              {["Initiatives", "Projects", "Views", "Loops"].map((label) => (
                <Nav.Item key={label} value={label.toLowerCase()} className={rowClass}>
                  <Nav.Icon>
                    <BoxIcon />
                  </Nav.Icon>
                  <Nav.Label className="min-w-0 truncate">{label}</Nav.Label>
                </Nav.Item>
              ))}
            </Nav.List>
          </Nav.Group>
        </Nav.List>
      </Nav.Root>

      {/* A 6px hit area with a hairline inside, so the target is comfortable
          while the divider stays thin. */}
      <Shell.ResizeHandle
        aria-label="Resize sidebar"
        className={[
          "-right-[3px] absolute inset-y-0 w-1.5 cursor-col-resize select-none",
          "before:absolute before:inset-y-0 before:left-1/2 before:w-px before:-translate-x-1/2 before:bg-transparent before:transition-colors before:duration-100",
          "hover:before:bg-[#1a1a1a] data-[resizing]:before:bg-[#1a1a1a] dark:hover:before:bg-[#fcfcfc] dark:data-[resizing]:before:bg-[#fcfcfc]",
          "focus-visible:-outline-offset-2 focus-visible:outline-2 focus-visible:outline-[#1a1a1a] dark:focus-visible:outline-[#fcfcfc]",
          "data-[state=collapsed]:hidden",
        ].join(" ")}
      />
    </Shell.Sidebar>

    {/* The gutter only exists while the sidebar does: collapsed, the card runs
        edge to edge. */}
    <Shell.Viewport className="flex min-w-0 flex-1 flex-col p-2">
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-[#f0f0f0] bg-white dark:border-[#262626] dark:bg-[#181818]">
        <div className="flex h-11 shrink-0 items-center gap-1 border-[#f0f0f0] border-b px-3 dark:border-[#262626]">
          <span className="px-1 text-[#949494] text-sm dark:text-[#6f6f6f]">Docs</span>
          <ChevronIcon className="size-3 -rotate-90 text-[#949494] dark:text-[#6f6f6f]" />
          <span className="px-1 font-medium text-[#1a1a1a] text-sm dark:text-[#fcfcfc]">
            Overview
          </span>
        </div>
        <article className="min-h-0 flex-1 overflow-auto px-8 py-8">
          <h1 className="mb-6 font-semibold text-[#1a1a1a] text-2xl tracking-tight dark:text-[#fcfcfc]">
            Overview
          </h1>
          <p className="mb-4 text-[#686868] text-sm leading-[1.7] dark:text-[#9b9b9b]">
            Collapse the sidebar with the button in its header, then rest the pointer against the
            left edge to float it back out as a card. Drag the divider to resize it, or nudge it
            with the arrow keys once the handle has focus.
          </p>
          <p className="text-[#686868] text-sm leading-[1.7] dark:text-[#9b9b9b]">
            The width and the range it may be dragged through are this stylesheet&apos;s; the
            primitive only measures and reports back.
          </p>
        </article>
      </div>
    </Shell.Viewport>
  </Shell.Root>
);

const iconButtonClass =
  "grid size-7 shrink-0 cursor-pointer select-none place-items-center rounded-md text-[#686868] transition-colors hover:bg-[#f4f4f4] hover:text-[#1a1a1a] focus-visible:-outline-offset-2 focus-visible:outline-2 focus-visible:outline-[#1a1a1a] dark:text-[#9b9b9b] dark:hover:bg-[#232323] dark:hover:text-[#fcfcfc] dark:focus-visible:outline-[#fcfcfc]";

// An explicit height is load-bearing: 14px text has a fractional line-height,
// so padded rows land on a fraction of a pixel and nothing lines up.
const rowClass = [
  "group/row flex h-8 shrink-0 cursor-pointer select-none items-center gap-2 rounded-md px-2 text-sm",
  "text-[#686868] transition-colors hover:bg-[#f4f4f4] hover:text-[#1a1a1a] dark:text-[#9b9b9b] dark:hover:bg-[#232323] dark:hover:text-[#fcfcfc]",
  "focus-visible:-outline-offset-2 focus-visible:outline-2 focus-visible:outline-[#1a1a1a] dark:focus-visible:outline-[#fcfcfc]",
  "data-[active]:bg-[#ececec] data-[active]:text-[#1a1a1a] dark:data-[active]:bg-[#2d2d2d] dark:data-[active]:text-[#fcfcfc]",
  "[&_svg]:size-4 [&_svg]:shrink-0",
].join(" ");

const PanelLeftIcon = (props: ComponentProps<"svg">) => (
  <svg
    viewBox="0 0 16 16"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.3"
    strokeLinejoin="round"
    className="size-4"
    aria-hidden="true"
    {...props}
  >
    <rect x="2" y="3" width="12" height="10" rx="2" />
    <path d="M6.5 3v10" />
  </svg>
);

const HomeIcon = (props: ComponentProps<"svg">) => (
  <svg
    viewBox="0 0 16 16"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.3"
    aria-hidden="true"
    {...props}
  >
    <path d="M2.5 6.5 8 2.5l5.5 4v6a1 1 0 0 1-1 1h-9a1 1 0 0 1-1-1v-6Z" strokeLinejoin="round" />
  </svg>
);

const InboxIcon = (props: ComponentProps<"svg">) => (
  <svg
    viewBox="0 0 16 16"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.3"
    aria-hidden="true"
    {...props}
  >
    <path d="M2.5 8.5h3l1 2h3l1-2h3v3a1 1 0 0 1-1 1h-9a1 1 0 0 1-1-1v-3Z" strokeLinejoin="round" />
    <path
      d="M2.5 8.5l1.6-4.2a1 1 0 0 1 .94-.65h5.92a1 1 0 0 1 .94.65l1.6 4.2"
      strokeLinejoin="round"
    />
  </svg>
);

const BoxIcon = (props: ComponentProps<"svg">) => (
  <svg
    viewBox="0 0 16 16"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.3"
    aria-hidden="true"
    {...props}
  >
    <rect x="2.5" y="2.5" width="11" height="11" rx="2.5" strokeLinejoin="round" />
  </svg>
);

const ChevronIcon = (props: ComponentProps<"svg">) => (
  <svg
    viewBox="0 0 16 16"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
    {...props}
  >
    <path d="m4 6.5 4 4 4-4" />
  </svg>
);
