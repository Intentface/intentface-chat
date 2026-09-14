"use client";

import { Nav, type NavStore, useNavStore } from "@intentface/chat/nav";
import { type ComponentProps, useState } from "react";

const GROUPS = ["workspace", "projects", "archive"];

/*
 * Driving the tree from outside it.
 *
 * `Nav.createStore()` is the handle. Pass it to the Root and the primitive
 * uses it instead of creating its own, so the buttons below — siblings of the
 * Root, not descendants — can read the open set and replace it wholesale.
 *
 * The store is created inside `useState` so it survives re-renders. There is
 * no global fallback, which is what stops a tree being driven by accident from
 * somewhere that merely imported this.
 */
export const ExternalNav = () => {
  const [store] = useState(() => Nav.createStore());

  return (
    <div className="external-nav-demo flex w-full flex-col items-center gap-3">
      <Nav.Root
        store={store}
        aria-label="Workspace"
        guide="indent"
        render={<nav />}
        className="flex w-72 flex-col gap-0.5 rounded-xl border border-[#f0f0f0] bg-white px-2 py-2 dark:border-[#262626] dark:bg-[#111111]"
      >
        <Nav.List guide="none" className={listClass}>
          {GROUPS.map((value) => (
            <Nav.Group key={value} value={value}>
              <Nav.Trigger className={rowClass}>
                <Nav.Label className="min-w-0 truncate capitalize">{value}</Nav.Label>
                <Chevron />
              </Nav.Trigger>

              <Nav.List className={listClass}>
                {["Overview", "Activity"].map((label) => (
                  <Nav.Item key={label} value={`${value}-${label}`} className={rowClass}>
                    <Nav.Label className="min-w-0 truncate">{label}</Nav.Label>
                  </Nav.Item>
                ))}
              </Nav.List>
            </Nav.Group>
          ))}
        </Nav.List>
      </Nav.Root>

      <Controls store={store} />
      <CollapseRecipe />
    </div>
  );
};

/**
 * Outside the Root, reaching the same state through the handle. It both reads
 * the open set — which is what disables each button once it would do nothing —
 * and replaces it, so the handle is doing the same two jobs context would.
 */
const Controls = ({ store }: { store: NavStore }) => {
  const expanded = useNavStore(store, (nav) => nav.expanded);

  return (
    <div className="flex flex-wrap items-center justify-center gap-2">
      <button
        type="button"
        disabled={expanded.size === GROUPS.length}
        onClick={() => store.getSnapshot().setExpanded(GROUPS)}
        className={buttonClass}
      >
        Expand all
      </button>
      <button
        type="button"
        disabled={expanded.size === 0}
        onClick={() => store.getSnapshot().setExpanded([])}
        className={buttonClass}
      >
        Collapse all
      </button>
    </div>
  );
};

const buttonClass =
  "h-8 cursor-pointer rounded-full border border-[#e4e4e4] bg-white px-4 font-medium text-[#1a1a1a] text-sm transition-colors hover:bg-[#f4f4f4] disabled:cursor-default disabled:opacity-40 disabled:hover:bg-white focus-visible:-outline-offset-2 focus-visible:outline-2 focus-visible:outline-[#1a1a1a] dark:border-[#2d2d2d] dark:bg-[#181818] dark:text-[#fcfcfc] dark:hover:bg-[#232323] dark:focus-visible:outline-[#fcfcfc]";

const listClass = "flex flex-col gap-0.5";

const rowClass = [
  "group/row flex h-8 shrink-0 cursor-pointer select-none items-center gap-2 rounded-md px-2 text-sm",
  "text-[#686868] transition-colors dark:text-[#9b9b9b]",
  "hover:bg-[#f4f4f4] hover:text-[#1a1a1a] dark:hover:bg-[#232323] dark:hover:text-[#fcfcfc]",
  "focus-visible:-outline-offset-2 focus-visible:outline-2 focus-visible:outline-[#1a1a1a] dark:focus-visible:outline-[#fcfcfc]",
].join(" ");

const Chevron = () => (
  <ChevronIcon className="ml-auto size-3 text-[#949494] transition-transform group-data-closed/row:-rotate-90 dark:text-[#6f6f6f]" />
);

const CollapseRecipe = () => (
  <style>{`
.external-nav-demo [data-nav-group] > [data-nav-list] {
  height: var(--nav-list-height);
  overflow: hidden;
  opacity: 1;
  transition: height 200ms cubic-bezier(0.4, 0, 0.2, 1), opacity 200ms ease-out;
}
.external-nav-demo [data-nav-list][data-starting-style],
.external-nav-demo [data-nav-list][data-ending-style] { height: 0; opacity: 0; }
.external-nav-demo [data-nav-list] > * { flex-shrink: 0; }
.external-nav-demo [data-nav-list][data-indent] { margin-left: 15px; padding-left: 7px; }
`}</style>
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
