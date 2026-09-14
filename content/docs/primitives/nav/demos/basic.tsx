"use client";

import { Nav } from "@intentface/chat/nav";
import { type ComponentProps, useState } from "react";

/*
 * Modelled on the hard case: a section group with no rail, a group two levels
 * in that has branches, plain indented lists nested inside it, an outer rail
 * carrying on past an expanded inner group, and a collapsed group as the last
 * child.
 *
 * All of it is one `Nav.Group` nesting inside itself. There is no second set of
 * parts for the nesting and no depth-aware CSS — the rail recipe below is a
 * single rule that works at any depth. The Root's `guide` is the default every
 * list inherits — "indent", a lane with nothing drawn in it — and lists opt
 * out with "none" or up to "branches" where the tree forks.
 *
 * Leaves are real links. `render` in its function form hands over everything
 * the part would have put on its own div — attributes, handlers, ref, children
 * — and you decide the element. (That form is also why this is a client
 * component: a function cannot cross the server boundary. The element form,
 * `render={<a href="…" />}`, can.)
 *
 * Written out in full rather than folded into a local Row component, so the
 * anatomy here is the anatomy of the primitive.
 */
export const Basic = () => {
  const [current, setCurrent] = useState("chat-views");

  return (
    <div className="nav-demo w-64 rounded-xl border border-[#f0f0f0] bg-white py-2 [--rail:#e4e4e4] dark:border-[#262626] dark:bg-[#111111] dark:[--rail:#2d2d2d]">
      <RailRecipe />
      <Nav.Root
        aria-label="Main"
        guide="indent"
        defaultExpanded={["teams", "intentface", "chat"]}
        render={<nav />}
        className="flex flex-col gap-0.5 px-2"
      >
        <Nav.List guide="none" className={listClass}>
          <Nav.Item
            value="overview"
            active={current === "overview"}
            className={rowClass}
            render={link("/overview", () => setCurrent("overview"))}
          >
            <Nav.Icon>
              <HomeIcon />
            </Nav.Icon>
            <Nav.Label className="min-w-0 truncate">Overview</Nav.Label>
          </Nav.Item>

          <Nav.Item
            value="inbox"
            active={current === "inbox"}
            className={rowClass}
            render={link("/inbox", () => setCurrent("inbox"))}
          >
            <Nav.Icon>
              <InboxIcon />
            </Nav.Icon>
            <Nav.Label className="min-w-0 truncate">Inbox</Nav.Label>
          </Nav.Item>

          {/* A section heading whose children are a plain indented list. `guide`
            is a prop rather than something derived from depth precisely so a
            railless group stays possible. */}
          <Nav.Group value="teams" className="mt-3">
            <Nav.Trigger className={rowClass}>
              <Nav.Label className="min-w-0 truncate">Your teams</Nav.Label>
              <Chevron />
            </Nav.Trigger>

            <Nav.List guide="none" className={listClass}>
              <Nav.Group value="intentface">
                <Nav.Trigger className={rowClass}>
                  <Nav.Icon>
                    <BoxIcon />
                  </Nav.Icon>
                  <Nav.Label className="min-w-0 truncate">Intentface</Nav.Label>
                  <Chevron />
                </Nav.Trigger>

                {/* Elbows, and only on groups — one at every leaf turns the rail
                  into a comb and buries where the tree actually forks. */}
                <Nav.List guide="branches" className={listClass}>
                  <Nav.Item
                    value="team-home"
                    active={current === "team-home"}
                    className={rowClass}
                    render={link("/intentface/home", () => setCurrent("team-home"))}
                  >
                    <Nav.Icon>
                      <HomeIcon />
                    </Nav.Icon>
                    <Nav.Label className="min-w-0 truncate">Home</Nav.Label>
                  </Nav.Item>

                  <Nav.Item
                    value="team-issues"
                    active={current === "team-issues"}
                    className={rowClass}
                    render={link("/intentface/issues", () => setCurrent("team-issues"))}
                  >
                    <Nav.Icon>
                      <InboxIcon />
                    </Nav.Icon>
                    <Nav.Label className="min-w-0 truncate">Issues</Nav.Label>
                  </Nav.Item>

                  {/* The rail above carries on past this whole group to its next
                    sibling — that is what the ::after on a group child is for.
                    The group's own list inherits "indent" and just indents. */}
                  <Nav.Group value="chat">
                    <Nav.Trigger className={rowClass}>
                      <Nav.Icon>
                        <ChatIcon />
                      </Nav.Icon>
                      <Nav.Label className="min-w-0 truncate">Chat</Nav.Label>
                      <Chevron />
                    </Nav.Trigger>

                    <Nav.List className={listClass}>
                      <Nav.Item
                        value="chat-home"
                        active={current === "chat-home"}
                        className={rowClass}
                        render={link("/intentface/chat/home", () => setCurrent("chat-home"))}
                      >
                        <Nav.Label className="min-w-0 truncate">Home</Nav.Label>
                      </Nav.Item>
                      <Nav.Item
                        value="chat-views"
                        active={current === "chat-views"}
                        className={rowClass}
                        render={link("/intentface/chat/views", () => setCurrent("chat-views"))}
                      >
                        <Nav.Label className="min-w-0 truncate">Views</Nav.Label>
                      </Nav.Item>
                    </Nav.List>
                  </Nav.Group>

                  {/* Collapsed, and the last child — so the rail stops at its
                    elbow rather than running on into empty space. */}
                  <Nav.Group value="website">
                    <Nav.Trigger className={rowClass}>
                      <Nav.Icon>
                        <BoxIcon />
                      </Nav.Icon>
                      <Nav.Label className="min-w-0 truncate">Website</Nav.Label>
                      <Chevron />
                    </Nav.Trigger>

                    <Nav.List className={listClass}>
                      <Nav.Item
                        value="site-home"
                        active={current === "site-home"}
                        className={rowClass}
                        render={link("/website/home", () => setCurrent("site-home"))}
                      >
                        <Nav.Label className="min-w-0 truncate">Home</Nav.Label>
                      </Nav.Item>
                    </Nav.List>
                  </Nav.Group>
                </Nav.List>
              </Nav.Group>
            </Nav.List>
          </Nav.Group>
        </Nav.List>
      </Nav.Root>
    </div>
  );
};

/**
 * Every leaf is a real anchor — that is the point of the function form. A real
 * app hands it a route and lets the browser navigate; this one is a demo on a
 * docs page, so it keeps the href for the semantics and stops the jump.
 */
const link = (href: string, onSelect: () => void) => (props: ComponentProps<"a">) => (
  <a
    {...props}
    href={href}
    onClick={(event) => {
      event.preventDefault();
      onSelect();
      props.onClick?.(event);
    }}
  />
);

const listClass = "flex flex-col gap-0.5";

/*
 * One row style for leaves and group headings alike — in a sidebar they are the
 * same thing you click, and the only visible difference is the chevron.
 *
 * The explicit height is load-bearing: 14px text has a fractional line-height,
 * so padded rows land on a fraction of a pixel and nothing lines up. And no
 * `truncate` here — `overflow: hidden` on a row would clip the ::before and
 * ::after that draw the rail, which sit outside its box. The label truncates
 * instead, which is what a separate part is for.
 */
const rowClass = [
  "group/row flex h-8 shrink-0 cursor-pointer select-none items-center gap-2 rounded-md px-2 text-sm",
  // No `outline-none` here: it sets --tw-outline-style: none, and the
  // focus-visible ring below resolves its style from that very variable — so
  // the ring would be 2px of nothing.
  "text-[#686868] no-underline transition-colors dark:text-[#9b9b9b]",
  "hover:bg-[#f4f4f4] hover:text-[#1a1a1a] dark:hover:bg-[#232323] dark:hover:text-[#fcfcfc]",
  "focus-visible:-outline-offset-2 focus-visible:outline-2 focus-visible:outline-[#1a1a1a] dark:focus-visible:outline-[#fcfcfc]",
  "data-[active]:bg-[#ececec] data-[active]:text-[#1a1a1a] dark:data-[active]:bg-[#2d2d2d] dark:data-[active]:text-[#fcfcfc]",
  "data-[disabled]:pointer-events-none data-[disabled]:opacity-40",
  "[&_svg]:size-4 [&_svg]:shrink-0",
].join(" ");

/**
 * The disclosure arrow. Not a part of the primitive — it is this sidebar's
 * convention, not the widget's. It rotates with the group it belongs to by
 * reading `data-closed` off the enclosing trigger, so nothing is threaded down.
 */
const Chevron = () => (
  <ChevronIcon className="ml-auto !size-3 text-[#949494] transition-transform group-data-[closed]/row:-rotate-90 dark:text-[#6f6f6f]" />
);

/*
 * The rail, its branches and the collapse. The package publishes the signal
 * (`data-rail`, `data-branches`, `data-open`); the geometry is yours. Copy it
 * and change the numbers:
 *
 *   15px  hangs the rail under the centre of a size-4 icon at px-2, so it drops
 *         out of the parent's icon rather than beside it.
 *   7px   the rail's lane. It is the list's padding rather than the row's,
 *         because an active row paints a background and would cover a line
 *         drawn inside its own box.
 *   6px   the elbow's corner radius. The curve pulls the vertical away 6px
 *         early, so the continuation starts 6px above the row's centre.
 *   2px   the gap between rows, bridged so the line reads as unbroken.
 */
const RailRecipe = () => (
  <style>{`
.nav-demo [data-nav-group] > [data-nav-list] {
  height: var(--nav-list-height);
  overflow: hidden;
  opacity: 1;
  transition: height 200ms cubic-bezier(0.4, 0, 0.2, 1), opacity 200ms ease-out;
}
.nav-demo [data-nav-list][data-starting-style],
.nav-demo [data-nav-list][data-ending-style] { height: 0; opacity: 0; }
.nav-demo [data-nav-list] > * { flex-shrink: 0; }
.nav-demo [data-nav-list][data-indent] {
  --nav-row: 2rem;
  margin-top: 2px;
  margin-left: 15px;
  padding-left: 7px;
}
.nav-demo [data-nav-list][data-rail] > * { position: relative; overflow: visible; }
.nav-demo [data-nav-list][data-rail] > *::before,
.nav-demo [data-nav-list][data-rail] > *::after {
  content: "";
  position: absolute;
  left: -7px;
  border-color: var(--rail);
  border-left-width: 1px;
}
.nav-demo [data-nav-list][data-rail] > *::before {
  top: -2px;
  width: 6px;
  height: calc(var(--nav-row) / 2 + 2px);
}
.nav-demo [data-nav-list][data-rail] > *::after {
  top: calc(var(--nav-row) / 2 - 6px);
  bottom: -2px;
}
.nav-demo [data-nav-list][data-rail] > *:last-child::after { display: none; }
.nav-demo [data-nav-list][data-branches] > [data-nav-group]::before {
  border-bottom-width: 1px;
  border-bottom-left-radius: 6px;
}
@media (prefers-reduced-motion: reduce) {
  .nav-demo [data-nav-group] > [data-nav-list] { transition: none; }
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

const ChatIcon = (props: ComponentProps<"svg">) => (
  <svg
    viewBox="0 0 16 16"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.3"
    aria-hidden="true"
    {...props}
  >
    <path
      d="M13.5 8.5a4.5 4.5 0 0 1-4.5 4.5H6l-3 2v-2.6A4.5 4.5 0 0 1 6 4h3a4.5 4.5 0 0 1 4.5 4.5Z"
      strokeLinejoin="round"
    />
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
