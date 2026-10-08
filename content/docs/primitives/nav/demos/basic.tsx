"use client";

import { Nav } from "@intentface/chat/nav";
import { ChevronDown, Home, Inbox, MessageSquare, Package } from "@keyline-icons/react";
import { type ComponentProps, useState } from "react";
import "./rail.css";

/*
 * Modelled on the hard case: a section group with no rail, a group two levels
 * in that has branches, plain indented lists nested inside it, an outer rail
 * carrying on past an expanded inner group, and a collapsed group as the last
 * child.
 *
 * All of it is one `Nav.Group` nesting inside itself. There is no second set of
 * parts for the nesting and no depth-aware CSS — the rail recipe in rail.css is a
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
    <div className="relative nav-demo w-64 rounded-xl bg-[#f5f5f6] shadow-[0_0_0_1px_rgb(0_0_0/0.075),0_1px_2px_rgb(0_0_0/0.06),0_4px_8px_-2px_rgb(0_0_0/0.05)] py-2 [--rail:#e4e4e7] dark:bg-[#131315] dark:shadow-[0_0_0_1px_rgb(0_0_0/0.16),0_1px_2px_rgb(0_0_0/0.1)] dark:after:pointer-events-none dark:after:absolute dark:after:inset-0 dark:after:z-50 dark:after:rounded-[inherit] dark:after:shadow-[inset_0_1px_0_rgb(255_255_255/0.05),inset_0_0_0_1px_rgb(255_255_255/0.06)] dark:[--rail:#2b2b2e]">
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
              <Home className="size-4" />
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
              <Inbox className="size-4" />
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
                    <Package className="size-4" />
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
                      <Home className="size-4" />
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
                      <Inbox className="size-4" />
                    </Nav.Icon>
                    <Nav.Label className="min-w-0 truncate">Issues</Nav.Label>
                  </Nav.Item>

                  {/* The rail above carries on past this whole group to its next
                    sibling — that is what the ::after on a group child is for.
                    The group's own list inherits "indent" and just indents. */}
                  <Nav.Group value="chat">
                    <Nav.Trigger className={rowClass}>
                      <Nav.Icon>
                        <MessageSquare className="size-4" />
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
                        <Package className="size-4" />
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
 * The explicit height is load-bearing: 13px text has a fractional line-height,
 * so padded rows land on a fraction of a pixel and nothing lines up. And no
 * `truncate` here — `overflow: hidden` on a row would clip the ::before and
 * ::after that draw the rail, which sit outside its box. The label truncates
 * instead, which is what a separate part is for.
 */
const rowClass = [
  "group/row flex h-[30px] shrink-0 cursor-pointer select-none items-center gap-2 rounded-md px-2 font-medium text-[13px]",
  // No `outline-none` here: it sets --tw-outline-style: none, and the
  // focus-visible ring below resolves its style from that very variable — so
  // the ring would be 2px of nothing.
  "text-zinc-700 no-underline transition-colors dark:text-zinc-300",
  "hover:bg-zinc-950/5 hover:text-zinc-900 dark:hover:bg-white/8 dark:hover:text-zinc-100",
  // Inset: the collapsing lists clip their overflow, so an outset ring would be cut.
  "focus-visible:-outline-offset-2 focus-visible:outline-2 focus-visible:outline-[#0169cc]/60",
  // The selected row is raised off the sidebar. Its ring is inset because the
  // collapsing lists would clip one drawn outside the row.
  "data-[active]:bg-white data-[active]:bg-linear-to-b data-[active]:from-white data-[active]:to-[#fdfdfd] data-[active]:text-zinc-900 data-[active]:shadow-[inset_0_0_0_1px_rgb(0_0_0/0.075),0_1px_2px_rgb(0_0_0/0.07),0_2px_6px_-2px_rgb(0_0_0/0.05)]",
  "dark:data-[active]:bg-[#2d2d30] dark:data-[active]:from-[#29292c] dark:data-[active]:to-[#242427] dark:data-[active]:text-zinc-100 dark:data-[active]:shadow-[inset_0_1px_0_rgb(255_255_255/0.1),inset_0_0_0_1px_rgb(255_255_255/0.05),0_0_0_1px_rgb(0_0_0/0.16),0_1px_2px_rgb(0_0_0/0.1)]",
  "data-[disabled]:pointer-events-none data-[disabled]:opacity-40",
  "[&_svg]:size-4 [&_svg]:shrink-0",
].join(" ");

/**
 * The disclosure arrow. Not a part of the primitive — it is this sidebar's
 * convention, not the widget's. It rotates with the group it belongs to by
 * reading `data-closed` off the enclosing trigger, so nothing is threaded down.
 */
const Chevron = () => (
  <ChevronDown className="ml-auto !size-3 text-zinc-400 transition-transform group-data-[closed]/row:-rotate-90 dark:text-zinc-500" />
);
