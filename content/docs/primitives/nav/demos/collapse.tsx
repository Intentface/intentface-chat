"use client";

import { Nav } from "@intentface/chat/nav";
import { ChevronDown } from "@keyline-icons/react";
import "./collapse.css";

/*
 * The collapse, slowed to 500ms so the mechanism is visible.
 *
 * `height: auto` is not interpolable, so the transition needs two lengths. The
 * primitive publishes `--nav-list-height` — the measured content height —
 * while a transition runs and releases it the moment the opening one finishes.
 * With the variable gone, `height: var(--nav-list-height)` is invalid at
 * computed-value time and `height` lands back on `auto`.
 *
 * That release is the point. A list pinned to a pixel height permanently could
 * not hold a group that expands inside it — open the outer group, then the
 * inner one, and watch the outer keep growing.
 */
export const Collapse = () => (
  <div className="relative collapse-demo w-72 rounded-xl bg-[#f5f5f6] shadow-[0_0_0_1px_rgb(0_0_0/0.075),0_1px_2px_rgb(0_0_0/0.06),0_4px_8px_-2px_rgb(0_0_0/0.05)] py-2 dark:bg-[#131315] dark:shadow-[0_0_0_1px_rgb(0_0_0/0.16),0_1px_2px_rgb(0_0_0/0.1)] dark:after:pointer-events-none dark:after:absolute dark:after:inset-0 dark:after:z-50 dark:after:rounded-[inherit] dark:after:shadow-[inset_0_1px_0_rgb(255_255_255/0.05),inset_0_0_0_1px_rgb(255_255_255/0.06)]">
    <Nav.Root
      aria-label="Collapse"
      guide="indent"
      render={<nav />}
      className="flex flex-col gap-0.5 px-2"
    >
      <Nav.List guide="none" className={listClass}>
        <Nav.Group value="workspace">
          <Nav.Trigger className={rowClass}>
            <Nav.Label className="min-w-0 truncate">Workspace</Nav.Label>
            <Chevron />
          </Nav.Trigger>

          <Nav.List className={listClass}>
            <Nav.Item value="overview" className={rowClass}>
              <Nav.Label className="min-w-0 truncate">Overview</Nav.Label>
            </Nav.Item>

            {/* Opening this one grows the list above it, because that list is
                back on `auto` once its own transition settled. */}
            <Nav.Group value="projects">
              <Nav.Trigger className={rowClass}>
                <Nav.Label className="min-w-0 truncate">Projects</Nav.Label>
                <Chevron />
              </Nav.Trigger>

              <Nav.List className={listClass}>
                {["Chat", "Website", "Docs"].map((label) => (
                  <Nav.Item key={label} value={label.toLowerCase()} className={rowClass}>
                    <Nav.Label className="min-w-0 truncate">{label}</Nav.Label>
                  </Nav.Item>
                ))}
              </Nav.List>
            </Nav.Group>

            <Nav.Item value="settings" className={rowClass}>
              <Nav.Label className="min-w-0 truncate">Settings</Nav.Label>
            </Nav.Item>
          </Nav.List>
        </Nav.Group>
      </Nav.List>
    </Nav.Root>
  </div>
);

const listClass = "flex flex-col gap-0.5";

const rowClass = [
  "group/row flex h-[30px] shrink-0 cursor-pointer select-none items-center gap-2 rounded-md px-2 font-medium text-[13px]",
  "text-zinc-700 transition-colors dark:text-zinc-300",
  "hover:bg-zinc-950/5 hover:text-zinc-900 dark:hover:bg-white/8 dark:hover:text-zinc-100",
  // Inset: the collapsing lists clip their overflow, so an outset ring would be cut.
  "focus-visible:-outline-offset-2 focus-visible:outline-2 focus-visible:outline-[#0169cc]/60",
].join(" ");

const Chevron = () => (
  <ChevronDown className="ml-auto size-3 text-zinc-400 transition-transform group-data-closed/row:-rotate-90 dark:text-zinc-500" />
);
