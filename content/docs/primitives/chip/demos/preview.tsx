"use client";

import { Chip } from "@intentface/chat/chip";
import { type ReactElement, type ReactNode, useEffect, useRef, useState } from "react";

/*
 * `Chip.Preview` renders nothing itself. `renderWithPreview` hands you the
 * badge and the preview content and lets you decide what surface they go in,
 * which is the seam that keeps the package free of a floating library.
 *
 * Whatever you build there inherits the hover-card obligations: it has to open
 * on keyboard focus as well as hover, and Escape has to dismiss it. A CSS-only
 * `:hover` panel looks right and is unreachable without a pointer.
 */
export const Preview = () => (
  <p className="max-w-md text-[#1a1a1a] text-sm leading-8 dark:text-[#fcfcfc]">
    Cited{" "}
    <Chip.Root className={chipClass} renderWithPreview={renderWithPreview}>
      <Chip.Label>rfc-1149</Chip.Label>
      <Chip.Preview>
        <span className="font-medium text-[#1a1a1a] dark:text-[#fcfcfc]">
          A Standard for the Transmission of IP Datagrams on Avian Carriers
        </span>
        <span className="mt-1 block">Network Working Group, April 1990.</span>
      </Chip.Preview>
    </Chip.Root>{" "}
    and{" "}
    <Chip.Root variant="accent" className={chipClass} renderWithPreview={renderWithPreview}>
      <Chip.Label>rfc-2324</Chip.Label>
      <Chip.Preview>
        <span className="font-medium text-[#1a1a1a] dark:text-[#fcfcfc]">
          Hyper Text Coffee Pot Control Protocol
        </span>
        <span className="mt-1 block">Network Working Group, April 1998.</span>
      </Chip.Preview>
    </Chip.Root>
    . Tab to a chip, or hover it.
  </p>
);

/**
 * Hover and focus both open it, Escape and blur both close it, and the panel is
 * `aria-hidden` while closed so it never reaches a screen reader out of turn.
 * A real app would reach for a positioned hover card instead of hand-rolling
 * this; the obligations are the same either way.
 */
const renderWithPreview = (badge: ReactElement, preview: ReactNode) => (
  <PreviewSurface badge={badge} preview={preview} />
);

const PreviewSurface = ({ badge, preview }: { badge: ReactElement; preview: ReactNode }) => {
  const [open, setOpen] = useState(false);
  const host = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open]);

  return (
    <span ref={host} className="relative inline-block">
      {/* A real button, not a span with a tabIndex: this is the control that
          discloses the preview, so it should be one. It carries the pointer and
          focus handlers too, which keeps every listener on an element that can
          actually receive them. */}
      <button
        type="button"
        onPointerEnter={() => setOpen(true)}
        onPointerLeave={() => setOpen(false)}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        className="cursor-pointer rounded-md align-baseline focus-visible:outline-2 focus-visible:outline-[#1a1a1a] focus-visible:outline-offset-2 dark:focus-visible:outline-[#fcfcfc]"
      >
        {badge}
      </button>

      <span
        aria-hidden={!open}
        className={[
          "pointer-events-none absolute bottom-full left-1/2 z-10 mb-1.5 w-56 -translate-x-1/2",
          "rounded-lg border border-[#f0f0f0] bg-white p-2.5 text-left text-[#686868] text-xs leading-snug shadow-md",
          "transition-opacity duration-150 dark:border-[#2d2d2d] dark:bg-[#181818] dark:text-[#9b9b9b]",
          open ? "opacity-100" : "opacity-0",
        ].join(" ")}
      >
        {preview}
      </span>
    </span>
  );
};

const chipClass =
  "mx-0.5 inline-flex items-center gap-1 rounded-md border border-[#f0f0f0] bg-[#f4f4f4] px-1.5 py-0.5 align-baseline font-medium text-xs data-[variant=accent]:border-blue-200 data-[variant=accent]:bg-blue-50 data-[variant=accent]:text-blue-700 dark:border-[#2d2d2d] dark:bg-[#232323] dark:data-[variant=accent]:border-blue-900 dark:data-[variant=accent]:bg-blue-950 dark:data-[variant=accent]:text-blue-300";
