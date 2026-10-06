"use client";

import { Nav } from "@intentface/chat/nav";
import { type ComponentProps, useState } from "react";

/*
 * Branches that are also pages.
 *
 * "Guides" has an index of its own. The `Nav.Toggle` inside its trigger is what
 * makes it a destination: pressing the row (click, Enter or Space) shows the
 * page, and the caret opens the branch. ArrowRight and ArrowLeft still open and
 * close it from the row, which is why the caret can be pointer-only.
 *
 * "Reference" is an ordinary trigger beside it, for comparison: no toggle, so
 * its whole row is the disclosure and its chevron is only decoration.
 */
export const Destination = () => {
  const [page, setPage] = useState("guides");

  return (
    <div className="flex w-full max-w-xl flex-col gap-3 sm:flex-row">
      <div className="w-full shrink-0 rounded-xl border border-[#f0f0f0] bg-white py-2 sm:w-60 dark:border-[#262626] dark:bg-[#111111]">
        <Nav.Root
          aria-label="Documentation"
          defaultExpanded={["guides"]}
          render={<nav />}
          className="flex flex-col px-2"
        >
          <Nav.List className={listClass}>
            <Nav.Group value="guides">
              <Nav.Trigger
                active={page === "guides"}
                onClick={() => setPage("guides")}
                className={rowClass}
              >
                <Nav.Toggle className={toggleClass}>
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
                <span aria-hidden="true" className={chevronClass}>
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

      <div className="flex min-h-32 flex-1 items-center justify-center rounded-xl border border-[#f0f0f0] bg-white text-sm text-[#686868] dark:border-[#262626] dark:bg-[#111111] dark:text-[#9b9b9b]">
        Showing <span className="ml-1 font-medium text-[#1a1a1a] dark:text-[#fcfcfc]">{page}</span>
      </div>
    </div>
  );
};

const listClass = "flex flex-col gap-0.5";
const nestedClass = "ml-[15px] flex flex-col gap-0.5 pl-[7px]";

const rowClass = [
  "group/row flex h-8 shrink-0 cursor-pointer select-none items-center gap-1.5 rounded-md px-2 text-sm",
  "text-[#686868] transition-colors dark:text-[#9b9b9b]",
  "hover:bg-[#f4f4f4] hover:text-[#1a1a1a] dark:hover:bg-[#232323] dark:hover:text-[#fcfcfc]",
  "data-active:bg-[#f4f4f4] data-active:text-[#1a1a1a] dark:data-active:bg-[#232323] dark:data-active:text-[#fcfcfc]",
  "focus-visible:-outline-offset-2 focus-visible:outline-2 focus-visible:outline-[#1a1a1a] dark:focus-visible:outline-[#fcfcfc]",
].join(" ");

/* Its own hit area, a little larger than the glyph, so the caret is an easy
   target and the rest of the row stays the destination. */
const toggleClass = [
  "-ml-1 flex size-5 shrink-0 items-center justify-center rounded text-[#949494] dark:text-[#6f6f6f]",
  "transition-transform data-closed:-rotate-90",
  "hover:bg-[#e8e8e8] hover:text-[#1a1a1a] dark:hover:bg-[#2e2e2e] dark:hover:text-[#fcfcfc]",
].join(" ");

/* Decoration only: it turns with the row it sits in, through the row's data-closed. */
const chevronClass =
  "-ml-1 flex size-5 shrink-0 items-center justify-center text-[#949494] transition-transform group-data-closed/row:-rotate-90 dark:text-[#6f6f6f]";

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
