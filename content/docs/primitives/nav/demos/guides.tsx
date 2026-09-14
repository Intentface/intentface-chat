"use client";

import { Nav } from "@intentface/chat/nav";
import type { ComponentProps } from "react";

/*
 * The same tree four times, once per `guide` value, so the rungs can be
 * compared side by side. Nothing else differs between the four.
 *
 * The attributes are cumulative — "rail" emits `data-indent` as well, and
 * "branches" emits all three — which is why one stylesheet covers every value
 * without wrapping a selector in `:is()`. The geometry below is the same
 * recipe the Nav page documents; only the `guide` prop changes.
 */
export const Guides = () => (
  <div className="guides-demo grid w-full grid-cols-2 gap-3 lg:grid-cols-4">
    <GuideTree guide="none" caption="No lane, no attributes." />
    <GuideTree guide="indent" caption="The lane exists, nothing drawn in it." />
    <GuideTree guide="rail" caption="A line down the lane." />
    <GuideTree guide="branches" caption="Elbows off the rail, on groups only." />

    <RailRecipe />
  </div>
);

type GuideValue = "none" | "indent" | "rail" | "branches";

const GuideTree = ({ guide, caption }: { guide: GuideValue; caption: string }) => (
  <div className="flex min-w-0 flex-col gap-2">
    <div className="flex items-baseline gap-2">
      <code className="font-mono text-[#1a1a1a] text-xs dark:text-[#fcfcfc]">{guide}</code>
    </div>

    <div className="rounded-xl border border-[#f0f0f0] bg-white py-2 [--rail:#e4e4e4] dark:border-[#262626] dark:bg-[#111111] dark:[--rail:#2d2d2d]">
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
              <HomeIcon />
            </Nav.Icon>
            <Nav.Label className="min-w-0 truncate">Overview</Nav.Label>
          </Nav.Item>

          <Nav.Group value="chat">
            <Nav.Trigger className={rowClass}>
              <Nav.Icon>
                <BoxIcon />
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

    <p className="text-[#686868] text-xs leading-5 dark:text-[#9b9b9b]">{caption}</p>
  </div>
);

const listClass = "flex flex-col gap-0.5";

// The explicit height is load-bearing: 14px text has a fractional line-height,
// so padded rows land on a fraction of a pixel and the rail stops lining up.
const rowClass = [
  "group/row flex h-8 shrink-0 cursor-pointer select-none items-center gap-2 rounded-md px-2 text-sm",
  "text-[#686868] no-underline transition-colors dark:text-[#9b9b9b]",
  "hover:bg-[#f4f4f4] hover:text-[#1a1a1a] dark:hover:bg-[#232323] dark:hover:text-[#fcfcfc]",
  "focus-visible:-outline-offset-2 focus-visible:outline-2 focus-visible:outline-[#1a1a1a] dark:focus-visible:outline-[#fcfcfc]",
  "data-[active]:bg-[#ececec] data-[active]:text-[#1a1a1a] dark:data-[active]:bg-[#2d2d2d] dark:data-[active]:text-[#fcfcfc]",
  "[&_svg]:size-4 [&_svg]:shrink-0",
].join(" ");

const Chevron = () => (
  <ChevronIcon className="ml-auto size-3! text-[#949494] transition-transform group-data-closed/row:-rotate-90 dark:text-[#6f6f6f]" />
);

/*
 * One stylesheet for all four trees. Because the attributes are cumulative,
 * the `[data-indent]` rule sizes the lane for indent, rail and branches alike,
 * and `[data-rail]` draws for rail and branches alike.
 */
const RailRecipe = () => (
  <style>{`
.guides-demo [data-nav-group] > [data-nav-list] {
  height: var(--nav-list-height);
  overflow: hidden;
  opacity: 1;
  transition: height 200ms cubic-bezier(0.4, 0, 0.2, 1), opacity 200ms ease-out;
}
.guides-demo [data-nav-list][data-starting-style],
.guides-demo [data-nav-list][data-ending-style] { height: 0; opacity: 0; }
.guides-demo [data-nav-list] > * { flex-shrink: 0; }
.guides-demo [data-nav-list][data-indent] {
  --nav-row: 2rem;
  margin-top: 2px;
  margin-left: 15px;
  padding-left: 7px;
}
.guides-demo [data-nav-list][data-rail] > * { position: relative; overflow: visible; }
.guides-demo [data-nav-list][data-rail] > *::before,
.guides-demo [data-nav-list][data-rail] > *::after {
  content: "";
  position: absolute;
  left: -7px;
  border-color: var(--rail);
  border-left-width: 1px;
}
.guides-demo [data-nav-list][data-rail] > *::before {
  top: -2px;
  width: 6px;
  height: calc(var(--nav-row) / 2 + 2px);
}
.guides-demo [data-nav-list][data-rail] > *::after {
  top: calc(var(--nav-row) / 2 - 6px);
  bottom: -2px;
}
.guides-demo [data-nav-list][data-rail] > *:last-child::after { display: none; }
.guides-demo [data-nav-list][data-branches] > [data-nav-group]::before {
  border-bottom-width: 1px;
  border-bottom-left-radius: 6px;
}
`}</style>
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
