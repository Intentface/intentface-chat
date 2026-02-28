"use client";

import { memo, useEffect, useRef, useState } from "react";
import { Markdown } from "@/components/ui/markdown";
import { cn } from "@/lib/utils";

type CharState = {
  char: string;
  /** Number of consecutive snapshots this character has been stable */
  stability: number;
};

const computeCharStates = (content: string, prev: CharState[]): CharState[] => {
  const next: CharState[] = [];
  for (let i = 0; i < content.length; i++) {
    const char = content[i];
    const prevChar = prev[i];
    if (prevChar && prevChar.char === char) {
      next.push({ char, stability: prevChar.stability + 1 });
    } else {
      next.push({ char, stability: 0 });
    }
  }
  return next;
};

const stabilityClass = (stability: number): string => {
  if (stability === 0) return "diffusion-char-diffusing";
  if (stability <= 2) return "diffusion-char-resolving";
  return "diffusion-char-ready";
};

const REVEAL_DURATION = 600;

type DiffusionMarkdownProps = {
  content: string;
  isStreaming: boolean;
  className?: string;
};

const DiffusionMarkdown = memo(
  ({ content, isStreaming, className }: DiffusionMarkdownProps) => {
    const charStatesRef = useRef<CharState[]>([]);
    const [charStates, setCharStates] = useState<CharState[]>([]);
    const [revealing, setRevealing] = useState(false);
    const wasStreamingRef = useRef(isStreaming);

    useEffect(() => {
      if (!isStreaming) return;
      const next = computeCharStates(content, charStatesRef.current);
      charStatesRef.current = next;
      setCharStates(next);
    }, [content, isStreaming]);

    // Detect streaming → stopped transition
    useEffect(() => {
      if (wasStreamingRef.current && !isStreaming && charStates.length > 0) {
        setRevealing(true);
        const timer = setTimeout(() => setRevealing(false), REVEAL_DURATION);
        wasStreamingRef.current = isStreaming;
        return () => clearTimeout(timer);
      }
      wasStreamingRef.current = isStreaming;
    }, [isStreaming, charStates.length]);

    // Final state
    if (!isStreaming && !revealing) {
      return (
        <Markdown className={cn("size-full", className)}>{content}</Markdown>
      );
    }

    // Reveal transition: diffusion chars blur out, markdown wipes in on top
    if (revealing) {
      return (
        <div className={cn("relative", className)}>
          <div className="diffusion-container diffusion-chars-exit text-md whitespace-pre-wrap">
            {charStates.map((cs, i) => (
              <span key={i} className="diffusion-char-ready">
                {cs.char}
              </span>
            ))}
          </div>
          <div className="diffusion-reveal-mask absolute inset-0">
            <Markdown className="size-full">{content}</Markdown>
          </div>
        </div>
      );
    }

    // Streaming: character-level effects
    return (
      <div
        className={cn(
          "diffusion-container text-md whitespace-pre-wrap",
          className,
        )}
      >
        {charStates.map((cs, i) => (
          <span key={i} className={stabilityClass(cs.stability)}>
            {cs.char}
          </span>
        ))}
      </div>
    );
  },
);
DiffusionMarkdown.displayName = "DiffusionMarkdown";

export { DiffusionMarkdown };
