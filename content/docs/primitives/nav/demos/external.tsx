"use client";

import { Nav, type NavStore, useNavStore } from "@intentface/chat/nav";
import { ChevronDown } from "@keyline-icons/react";
import { useState } from "react";
import "./external.css";

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
        className="relative flex w-72 flex-col gap-0.5 rounded-xl bg-[#f5f5f6] shadow-[0_0_0_1px_rgb(0_0_0/0.075),0_1px_2px_rgb(0_0_0/0.06),0_4px_8px_-2px_rgb(0_0_0/0.05)] px-2 py-2 dark:bg-[#131315] dark:shadow-[0_0_0_1px_rgb(0_0_0/0.16),0_1px_2px_rgb(0_0_0/0.1)] dark:after:pointer-events-none dark:after:absolute dark:after:inset-0 dark:after:z-50 dark:after:rounded-[inherit] dark:after:shadow-[inset_0_1px_0_rgb(255_255_255/0.05),inset_0_0_0_1px_rgb(255_255_255/0.06)]"
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
  "h-8 cursor-pointer rounded-full bg-white bg-linear-to-b from-white to-[#fdfdfd] shadow-[inset_0_1px_0_#fff,0_0_0_1px_rgb(0_0_0/0.075),0_1px_2px_rgb(0_0_0/0.07),0_2px_6px_-2px_rgb(0_0_0/0.05)] px-4 font-medium text-[13px] text-zinc-900 enabled:hover:from-[#fafafa] enabled:hover:to-[#f6f6f6] disabled:cursor-default disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-[#0169cc]/60 focus-visible:outline-offset-2 dark:bg-[#2d2d30] dark:from-[#313134] dark:to-[#2a2a2d] dark:shadow-[inset_0_1px_0_rgb(255_255_255/0.1),inset_0_0_0_1px_rgb(255_255_255/0.05),0_0_0_1px_rgb(0_0_0/0.16),0_1px_2px_rgb(0_0_0/0.1)] dark:text-zinc-100 dark:enabled:hover:from-[#38383b] dark:enabled:hover:to-[#313134]";

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
