"use client";

import { Nav } from "@intentface/chat/nav";
import { type ComponentProps, useState } from "react";

/*
 * Branches that are also pages.
 *
 * "Guides" has an index of its own. The `Nav.Toggle` inside its trigger is what
 * makes it a destination: pressing the row (click, Enter or Space) shows the
 * page, and the caret opens the branch. The caret is a named button that says
 * whether the branch is open; ArrowRight and ArrowLeft still work from the row.
 *
 * "Reference" is an ordinary trigger beside it, for comparison: no toggle, so
 * its whole row is the disclosure and its chevron is only decoration.
 */
export const Destination = () => {
  const [page, setPage] = useState("guides");

  return (
    <div className="flex w-full max-w-xl flex-col gap-3 sm:flex-row">
      <div className="relative w-full shrink-0 rounded-xl bg-[#f5f5f6] shadow-[0_0_0_1px_rgb(0_0_0/0.075),0_1px_2px_rgb(0_0_0/0.06),0_4px_8px_-2px_rgb(0_0_0/0.05)] py-2 sm:w-60 dark:bg-[#131315] dark:shadow-[0_0_0_1px_rgb(0_0_0/0.16),0_1px_2px_rgb(0_0_0/0.1)] dark:after:pointer-events-none dark:after:absolute dark:after:inset-0 dark:after:z-50 dark:after:rounded-[inherit] dark:after:shadow-[inset_0_1px_0_rgb(255_255_255/0.05),inset_0_0_0_1px_rgb(255_255_255/0.06)]">
        <Nav.Root
          aria-label="Documentation"
          defaultExpanded={["guides"]}
          render={<nav />}
          className="flex flex-col px-2"
        >
          <Nav.List className="flex flex-col gap-0.5">
            <Nav.Group value="guides">
              <Nav.Trigger
                active={page === "guides"}
                onClick={() => setPage("guides")}
                className={rowClass}
              >
                {/* Its own hit area, a little larger than the glyph, so the caret is an
                    easy target and the rest of the row stays the destination. */}
                <Nav.Toggle
                  aria-label="More Guides pages"
                  className={[
                    "-ml-1 flex size-5 shrink-0 items-center justify-center rounded-full text-zinc-400 dark:text-zinc-500",
                    "transition-transform data-closed:-rotate-90",
                    "hover:bg-zinc-950/5 hover:text-zinc-900 dark:hover:bg-white/8 dark:hover:text-zinc-100",
                  ].join(" ")}
                >
                  <ChevronIcon className="size-3" />
                </Nav.Toggle>
                <Nav.Label className="min-w-0 truncate">Guides</Nav.Label>
              </Nav.Trigger>

              <Nav.List className={nestedClass}>
                {["Install", "Theming", "Deploy"].map((label) => (
                  <Nav.Item
                    key={label}
                    value={label.toLowerCase()}
                    active={page === label.toLowerCase()}
                    onClick={() => setPage(label.toLowerCase())}
                    className={rowClass}
                  >
                    <Nav.Label className="min-w-0 truncate">{label}</Nav.Label>
                  </Nav.Item>
                ))}
              </Nav.List>
            </Nav.Group>

            <Nav.Group value="reference">
              <Nav.Trigger className={rowClass}>
                {/* Decoration only: it turns with the row it sits in, through the row's
                    data-closed. */}
                <span
                  aria-hidden="true"
                  className="-ml-1 flex size-5 shrink-0 items-center justify-center text-zinc-400 transition-transform group-data-closed/row:-rotate-90 dark:text-zinc-500"
                >
                  <ChevronIcon className="size-3" />
                </span>
                <Nav.Label className="min-w-0 truncate">Reference</Nav.Label>
              </Nav.Trigger>

              <Nav.List className={nestedClass}>
                {["Props", "Hooks"].map((label) => (
                  <Nav.Item
                    key={label}
                    value={label.toLowerCase()}
                    active={page === label.toLowerCase()}
                    onClick={() => setPage(label.toLowerCase())}
                    className={rowClass}
                  >
                    <Nav.Label className="min-w-0 truncate">{label}</Nav.Label>
                  </Nav.Item>
                ))}
              </Nav.List>
            </Nav.Group>
          </Nav.List>
        </Nav.Root>
      </div>

      <div className="flex min-h-32 flex-1 items-center justify-center rounded-xl bg-white shadow-[0_0_0_1px_rgb(0_0_0/0.075),0_1px_2px_rgb(0_0_0/0.06),0_4px_8px_-2px_rgb(0_0_0/0.05)] text-[13px] text-zinc-500 dark:bg-zinc-900 dark:shadow-[inset_0_1px_0_rgb(255_255_255/0.05),inset_0_0_0_1px_rgb(255_255_255/0.06),0_0_0_1px_rgb(0_0_0/0.16),0_1px_2px_rgb(0_0_0/0.1)] dark:text-zinc-400">
        Showing <span className="ml-1 font-medium text-zinc-900 dark:text-zinc-100">{page}</span>
      </div>
    </div>
  );
};

const nestedClass = "ml-[15px] flex flex-col gap-0.5 pl-[7px]";

const rowClass = [
  "group/row flex h-[30px] shrink-0 cursor-pointer select-none items-center gap-1.5 rounded-md px-2 font-medium text-[13px]",
  "text-zinc-700 transition-colors dark:text-zinc-300",
  "hover:bg-zinc-950/5 hover:text-zinc-900 dark:hover:bg-white/8 dark:hover:text-zinc-100",
  // The selected row is raised off the sidebar.
  "data-active:bg-white data-active:bg-linear-to-b data-active:from-white data-active:to-[#fdfdfd] data-active:text-zinc-900 data-active:shadow-[inset_0_1px_0_#fff,0_0_0_1px_rgb(0_0_0/0.075),0_1px_2px_rgb(0_0_0/0.07),0_2px_6px_-2px_rgb(0_0_0/0.05)]",
  "dark:data-active:bg-[#2d2d30] dark:data-active:from-[#29292c] dark:data-active:to-[#242427] dark:data-active:text-zinc-100 dark:data-active:shadow-[inset_0_1px_0_rgb(255_255_255/0.1),inset_0_0_0_1px_rgb(255_255_255/0.05),0_0_0_1px_rgb(0_0_0/0.16),0_1px_2px_rgb(0_0_0/0.1)]",
  "focus-visible:-outline-offset-2 focus-visible:outline-2 focus-visible:outline-[#0169cc]/60",
].join(" ");

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
