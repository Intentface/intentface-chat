"use client";

import { Nav } from "@intentface/chat/nav";
import { IconChevronDown } from "@tabler/icons-react";

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
  <div className="collapse-demo w-72 rounded-xl border border-[#f0f0f0] bg-white py-2 dark:border-[#262626] dark:bg-[#111111]">
    <CollapseRecipe />

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
  "group/row flex h-8 shrink-0 cursor-pointer select-none items-center gap-2 rounded-md px-2 text-sm",
  "text-[#686868] transition-colors dark:text-[#9b9b9b]",
  "hover:bg-[#f4f4f4] hover:text-[#1a1a1a] dark:hover:bg-[#232323] dark:hover:text-[#fcfcfc]",
  "focus-visible:-outline-offset-2 focus-visible:outline-2 focus-visible:outline-[#1a1a1a] dark:focus-visible:outline-[#fcfcfc]",
].join(" ");

const Chevron = () => (
  <IconChevronDown className="ml-auto size-3 text-[#949494] transition-transform group-data-closed/row:-rotate-90 dark:text-[#6f6f6f]" />
);

/*
 * Deliberately slow. `flex-shrink: 0` on the rows is load-bearing: the
 * collapsing list squeezes to nothing, and a flex item shrinks below its own
 * height when the column runs short — so without it the rows compress instead
 * of sliding up behind the clip.
 */
const CollapseRecipe = () => (
  <style>{`
.collapse-demo [data-nav-group] > [data-nav-list] {
  height: var(--nav-list-height);
  overflow: hidden;
  opacity: 1;
  transition: height 500ms cubic-bezier(0.4, 0, 0.2, 1), opacity 500ms ease-out;
}
.collapse-demo [data-nav-list][data-starting-style],
.collapse-demo [data-nav-list][data-ending-style] { height: 0; opacity: 0; }
.collapse-demo [data-nav-list] > * { flex-shrink: 0; }
.collapse-demo [data-nav-list][data-indent] { margin-left: 15px; padding-left: 7px; }
`}</style>
);
