"use client";

import { memo, useEffect, useRef, useState } from "react";
import { Markdown } from "@/components/ui/markdown";
import { cn } from "@/lib/utils";

const REVEAL_DURATION = 600;
/** ms per 100px of container height, clamped between min/max */
const SWEEP_MS_PER_100PX = 120;
const SWEEP_MIN = 600;
const SWEEP_MAX = 2000;
/** Skip the scanline reveal if streaming lasted less than this (ms) */
const MIN_STREAM_DURATION = 300;

type Phase = "streaming" | "revealing" | "sweep" | "final";

type DiffusionMarkdownProps = {
  content: string;
  isStreaming: boolean;
  className?: string;
};

const DiffusionMarkdown = memo(({ content, isStreaming, className }: DiffusionMarkdownProps) => {
  const [phase, setPhase] = useState<Phase>(isStreaming ? "streaming" : "final");
  const wasStreamingRef = useRef(isStreaming);
  const firstContentTimeRef = useRef<number | null>(null);
  const sweepContainerRef = useRef<HTMLDivElement>(null);
  // Counter to force fresh CSS animations on each sweep
  const [sweepKey, setSweepKey] = useState(0);

  // Track when content first appeared during streaming
  if (isStreaming && content.length > 0 && firstContentTimeRef.current === null) {
    firstContentTimeRef.current = Date.now();
  }
  if (!isStreaming && phase === "final") {
    firstContentTimeRef.current = null;
  }

  // Phase transitions driven by isStreaming changes
  useEffect(() => {
    if (isStreaming) {
      setPhase("streaming");
      wasStreamingRef.current = true;
      return;
    }

    // streaming → stopped
    if (wasStreamingRef.current && content.length > 0) {
      wasStreamingRef.current = false;
      const elapsed = firstContentTimeRef.current ? Date.now() - firstContentTimeRef.current : 0;

      if (elapsed > MIN_STREAM_DURATION) {
        // Long enough stream — scanline reveal, then sweep, then final
        setPhase("revealing");
        const revealTimer = setTimeout(() => {
          setSweepKey((k) => k + 1);
          setPhase("sweep");
        }, REVEAL_DURATION);
        return () => clearTimeout(revealTimer);
      }

      // Fast response — skip scanline, go straight to sweep
      setSweepKey((k) => k + 1);
      setPhase("sweep");
      return;
    }

    wasStreamingRef.current = false;
  }, [isStreaming, content.length]);

  // Measure height and schedule sweep → final transition
  useEffect(() => {
    if (phase !== "sweep") return;

    const node = sweepContainerRef.current;
    if (!node) return;

    const height = node.offsetHeight;
    const duration = Math.min(SWEEP_MAX, Math.max(SWEEP_MIN, (height / 100) * SWEEP_MS_PER_100PX));
    node.style.setProperty("--sweep-duration", `${duration}ms`);

    const timer = setTimeout(() => setPhase("final"), duration + 50);
    return () => clearTimeout(timer);
  }, [phase]);

  // Final state — clean markdown, no wrappers
  if (phase === "final") {
    return <Markdown className={cn("size-full", className)}>{content}</Markdown>;
  }

  // Sweep: full-opacity content with decorative sweep line
  if (phase === "sweep") {
    return (
      <div
        ref={sweepContainerRef}
        className={cn("diffusion-sweep-container relative overflow-hidden", className)}
      >
        <Markdown className="size-full">{content}</Markdown>
        <div key={sweepKey} className="diffusion-sweep-line" aria-hidden="true" />
      </div>
    );
  }

  // Scanline reveal transition
  if (phase === "revealing") {
    return (
      <div className={cn("diffusion-scanline-container relative", className)}>
        {/* Bottom layer: diffusion-styled text that fades out */}
        <div className="diffusion-bottom-layer" aria-hidden="true">
          <Markdown className="size-full">{content}</Markdown>
        </div>
        {/* Top layer: clean markdown revealed by scanline */}
        <div className="diffusion-scanline-mask absolute inset-0">
          <Markdown className="size-full">{content}</Markdown>
        </div>
        {/* Scanline glow beam */}
        <div className="diffusion-scanline-beam" aria-hidden="true" />
      </div>
    );
  }

  // Streaming: formatted markdown with diffusion visual effect
  return (
    <div className={cn("diffusion-streaming", className)}>
      <Markdown className="size-full">{content}</Markdown>
    </div>
  );
});
DiffusionMarkdown.displayName = "DiffusionMarkdown";

export { DiffusionMarkdown };
