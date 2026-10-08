"use client";

import { RotateCcw } from "@keyline-icons/react";
import { motion, useReducedMotion } from "motion/react";
import { type ReactNode, useState } from "react";
import { IconButton } from "@/components/ui/icon-button";
import { useMeasure } from "@/hooks/use-measure";
import { cn } from "@/lib/utils";

type ComponentPreviewFrameProps = {
  preview: ReactNode;
  code: ReactNode;
};

type View = "preview" | "code";

const SWITCH_TRANSITION = { duration: 0.3, ease: [0.32, 0.72, 0, 1] } as const;
const INSTANT = { duration: 0 } as const;
const SHOWN = { opacity: 1, filter: "blur(0px)", transitionEnd: { filter: "none" } };
const HIDDEN = { opacity: 0, filter: "blur(4px)" };

// Client shell for the preview/code toggle. The server component highlights the
// source and renders the demo; this owns the tab state and the replay remount.
// One card holds both views: they cross-dissolve inside it while the card eases
// between their heights, and the demo stays mounted, keeping its state.
export const ComponentPreviewFrame = ({ preview, code }: ComponentPreviewFrameProps) => {
  const [tab, setTab] = useState<View>("preview");
  const [run, setRun] = useState(0);
  // Both views are measured, so a switch knows its target height up front.
  const [previewRef, previewBounds] = useMeasure<HTMLDivElement>();
  const [codeRef, codeBounds] = useMeasure<HTMLDivElement>();
  // Only a switch eases; a demo growing on its own is followed instantly.
  const [switching, setSwitching] = useState(false);
  const reduceMotion = useReducedMotion();

  const height = (tab === "preview" ? previewBounds : codeBounds).height;
  const paneTransition = reduceMotion ? INSTANT : SWITCH_TRANSITION;

  const select = (next: View) => {
    if (next === tab) return;
    setSwitching(true);
    setTab(next);
  };

  return (
    <div className="not-prose my-6 flex flex-col gap-3">
      <div role="tablist" aria-label="Demo view" className="flex items-center gap-0.5">
        {(["preview", "code"] as const).map((value) => (
          <button
            key={value}
            type="button"
            role="tab"
            aria-selected={tab === value}
            onClick={() => select(value)}
            className={cn(
              "h-7 cursor-pointer rounded-full px-3 font-medium text-sm capitalize transition-[color,background-color,box-shadow]",
              "focus-visible:outline-2 focus-visible:outline-accent-bg/60 focus-visible:outline-offset-2",
              tab === value
                ? "bg-raised text-ink-primary shadow-raised"
                : "text-ink-secondary hover:text-ink-primary",
            )}
          >
            {value}
          </button>
        ))}
      </div>
      {/* Clips only mid-switch, so a demo's own popups can spill out otherwise. */}
      <motion.div
        initial={false}
        animate={{ height: height || "auto" }}
        transition={switching ? paneTransition : INSTANT}
        onAnimationComplete={() => setSwitching(false)}
        className={cn(
          "relative rounded-xl bg-primary-bg shadow-card",
          switching && "overflow-hidden",
        )}
      >
        <motion.div
          ref={previewRef}
          inert={tab !== "preview"}
          initial={false}
          animate={tab === "preview" ? SHOWN : HIDDEN}
          transition={paneTransition}
          className={cn(
            paneClass(tab === "preview"),
            "flex min-h-60 items-center justify-center p-8",
          )}
        >
          {/* Replay remounts the demo, so animations and seeded state start over. */}
          <IconButton
            variant="ghost"
            size="sm"
            aria-label="Replay demo"
            onClick={() => setRun((current) => current + 1)}
            className="absolute top-2 right-2"
          >
            <RotateCcw />
          </IconButton>
          <div key={run} className="flex w-full items-center justify-center">
            {preview}
          </div>
        </motion.div>
        <motion.div
          ref={codeRef}
          inert={tab !== "code"}
          initial={false}
          animate={tab === "code" ? SHOWN : HIDDEN}
          transition={paneTransition}
          className={cn(paneClass(tab === "code"), "[&_pre]:max-h-[32rem]")}
        >
          {code}
        </motion.div>
      </motion.div>
    </div>
  );
};

// The active view sits in flow; the other lies over it, faded out.
const paneClass = (active: boolean) =>
  active ? "relative" : "pointer-events-none absolute inset-x-0 top-0";
