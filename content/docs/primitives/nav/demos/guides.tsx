"use client";

import { Nav } from "@intentface/chat/nav";
import { ChevronDown, Home, Package } from "@keyline-icons/react";
import "./guides-rail.css";

/*
 * The same tree four times, once per `guide` value, so the rungs can be
 * compared side by side. Nothing else differs between the four.
 *
 * The attributes are cumulative — "rail" emits `data-indent` as well, and
 * "branches" emits all three — which is why one stylesheet covers every value
 * without wrapping a selector in `:is()`. The geometry in guides-rail.css is
 * the same recipe the Nav page documents; only the `guide` prop changes.
 */
export const Guides = () => (
  <div className="guides-demo grid w-full grid-cols-2 gap-3 lg:grid-cols-4">
    <GuideTree guide="none" caption="No lane, no attributes." />
    <GuideTree guide="indent" caption="The lane exists, nothing drawn in it." />
    <GuideTree guide="rail" caption="A line down the lane." />
    <GuideTree guide="branches" caption="Elbows off the rail, on groups only." />
  </div>
);

type GuideValue = "none" | "indent" | "rail" | "branches";

const GuideTree = ({ guide, caption }: { guide: GuideValue; caption: string }) => (
  <div className="flex min-w-0 flex-col gap-2">
    <div className="flex items-baseline gap-2">
      <code className="font-mono text-xs text-zinc-900 dark:text-zinc-100">{guide}</code>
    </div>

    <div className="relative rounded-xl bg-[#f5f5f6] shadow-[0_0_0_1px_rgb(0_0_0/0.075),0_1px_2px_rgb(0_0_0/0.06),0_4px_8px_-2px_rgb(0_0_0/0.05)] py-2 [--rail:#e4e4e7] dark:bg-[#131315] dark:shadow-[0_0_0_1px_rgb(0_0_0/0.16),0_1px_2px_rgb(0_0_0/0.1)] dark:after:pointer-events-none dark:after:absolute dark:after:inset-0 dark:after:z-50 dark:after:rounded-[inherit] dark:after:shadow-[inset_0_1px_0_rgb(255_255_255/0.05),inset_0_0_0_1px_rgb(255_255_255/0.06)] dark:[--rail:#2b2b2e]">
      <Nav.Root
        aria-label={`Guide: ${guide}`}
        guide={guide}
        defaultExpanded={["chat"]}
        render={<nav />}
        className="flex flex-col gap-0.5 px-2"
      >
        {/* The top list opts out: a rail beside the top level would have
            nothing to descend from. Every nested list inherits the Root's. */}
        <Nav.List guide="none" className={listClass}>
          <Nav.Item value="overview" active className={rowClass}>
            <Nav.Icon>
              <Home className="size-4" />
            </Nav.Icon>
            <Nav.Label className="min-w-0 truncate">Overview</Nav.Label>
          </Nav.Item>

          <Nav.Group value="chat">
            <Nav.Trigger className={rowClass}>
              <Nav.Icon>
                <Package className="size-4" />
              </Nav.Icon>
              <Nav.Label className="min-w-0 truncate">Chat</Nav.Label>
              <Chevron />
            </Nav.Trigger>

            <Nav.List className={listClass}>
              <Nav.Item value="home" className={rowClass}>
                <Nav.Label className="min-w-0 truncate">Home</Nav.Label>
              </Nav.Item>

              {/* A group as the last child: with "branches" its elbow is drawn
                  and the rail stops there rather than running into space. */}
              <Nav.Group value="views">
                <Nav.Trigger className={rowClass}>
                  <Nav.Label className="min-w-0 truncate">Views</Nav.Label>
                  <Chevron />
                </Nav.Trigger>

                <Nav.List className={listClass}>
                  <Nav.Item value="active" className={rowClass}>
                    <Nav.Label className="min-w-0 truncate">Active</Nav.Label>
                  </Nav.Item>
                </Nav.List>
              </Nav.Group>
            </Nav.List>
          </Nav.Group>
        </Nav.List>
      </Nav.Root>
    </div>

    <p className="text-xs text-zinc-500 leading-5 dark:text-zinc-400">{caption}</p>
  </div>
);

const listClass = "flex flex-col gap-0.5";

// The explicit height is load-bearing: 13px text has a fractional line-height,
// so padded rows land on a fraction of a pixel and the rail stops lining up.
const rowClass = [
  "group/row flex h-[30px] shrink-0 cursor-pointer select-none items-center gap-2 rounded-md px-2 font-medium text-[13px]",
  "text-zinc-700 no-underline transition-colors dark:text-zinc-300",
  "hover:bg-zinc-950/5 hover:text-zinc-900 dark:hover:bg-white/8 dark:hover:text-zinc-100",
  // Inset: the collapsing lists clip their overflow, so an outset ring would be cut.
  "focus-visible:-outline-offset-2 focus-visible:outline-2 focus-visible:outline-[#0169cc]/60",
  // The selected row is raised off the sidebar.
  "data-[active]:bg-white data-[active]:bg-linear-to-b data-[active]:from-white data-[active]:to-[#fdfdfd] data-[active]:text-zinc-900 data-[active]:shadow-[inset_0_1px_0_#fff,0_0_0_1px_rgb(0_0_0/0.075),0_1px_2px_rgb(0_0_0/0.07),0_2px_6px_-2px_rgb(0_0_0/0.05)]",
  "dark:data-[active]:bg-[#2d2d30] dark:data-[active]:from-[#29292c] dark:data-[active]:to-[#242427] dark:data-[active]:text-zinc-100 dark:data-[active]:shadow-[inset_0_1px_0_rgb(255_255_255/0.1),inset_0_0_0_1px_rgb(255_255_255/0.05),0_0_0_1px_rgb(0_0_0/0.16),0_1px_2px_rgb(0_0_0/0.1)]",
  "[&_svg]:size-4 [&_svg]:shrink-0",
].join(" ");

const Chevron = () => (
  <ChevronDown className="ml-auto size-3! text-zinc-400 transition-transform group-data-closed/row:-rotate-90 dark:text-zinc-500" />
);
