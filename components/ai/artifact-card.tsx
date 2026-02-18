"use client";

import { FileTextIcon, LoaderIcon } from "lucide-react";
import { motion } from "motion/react";
import { type ComponentProps, useEffect, useRef } from "react";
import { cn } from "@/lib/utils";

type ArtifactCardProps = ComponentProps<typeof motion.button> & {
  title: string;
  state: string;
  onOpen: () => void;
  onToggle: () => void;
};

export const ArtifactCard = ({
  title,
  state,
  onOpen,
  onToggle,
  className,
  ...props
}: ArtifactCardProps) => {
  const isStreaming = state === "input-streaming";
  const hasAutoOpened = useRef(false);

  // Auto-open once input is available (not just streaming)
  useEffect(() => {
    if (!isStreaming && !hasAutoOpened.current && title) {
      hasAutoOpened.current = true;
      onOpen();
    }
  }, [isStreaming, onOpen, title]);

  return (
    <motion.button
      type="button"
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.15 }}
      data-slot="artifact-card"
      onClick={onToggle}
      disabled={isStreaming}
      className={cn(
        "flex w-full max-w-xs cursor-pointer items-center gap-3 rounded-xl border border-border bg-muted/50 px-4 py-3 text-left transition-colors",
        "hover:bg-muted disabled:cursor-default disabled:opacity-70",
        className,
      )}
      {...props}
    >
      <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
        {isStreaming ? (
          <LoaderIcon className="size-4 animate-spin" />
        ) : (
          <FileTextIcon className="size-4" />
        )}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{title}</p>
        <p className="text-xs text-muted-foreground">
          {isStreaming ? "Creating..." : "Click to open"}
        </p>
      </div>
    </motion.button>
  );
};
