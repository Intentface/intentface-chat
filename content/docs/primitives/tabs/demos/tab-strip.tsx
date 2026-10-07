"use client";

import { useTabs } from "@intentface/chat/tabs";
import { type ReactNode, useEffect, useRef } from "react";
import "./tab-strip.css";

/*
 * The scrolling half of the strip. Its edges fade only where tabs are hidden
 * behind them — see tab-strip.css — and the open tab is brought into view
 * whenever the selection moves, since a tab added at the end would otherwise
 * open off-screen.
 */
export const TabStrip = ({ children }: { children: ReactNode }) => {
  const ref = useRef<HTMLDivElement | null>(null);
  const value = useTabs((tabs) => tabs.value);

  // biome-ignore lint/correctness/useExhaustiveDependencies: `value` is the trigger, not an input — the open tab is found off the DOM, and this has to re-run whenever the selection moves.
  useEffect(() => {
    ref.current
      ?.querySelector("[data-tabs-trigger][data-selected]")
      ?.scrollIntoView({ block: "nearest", inline: "nearest" });
  }, [value]);

  return (
    <div
      ref={ref}
      className="scroll-mask-x -mx-1 -my-1.5 min-w-0 overflow-x-auto px-1 py-1.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
    >
      {children}
    </div>
  );
};
