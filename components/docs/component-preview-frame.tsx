"use client";

import { type ReactNode, useState } from "react";
import { cn } from "@/lib/utils";

type ComponentPreviewFrameProps = {
  preview: ReactNode;
  code: ReactNode;
};

// Client shell for the preview/code toggle. The server component highlights the
// source and renders the demo; this only owns the tab state.
export const ComponentPreviewFrame = ({ preview, code }: ComponentPreviewFrameProps) => {
  const [tab, setTab] = useState<"preview" | "code">("preview");

  return (
    <div className="not-prose my-6 overflow-hidden rounded-xl border border-primary-border">
      <div className="flex items-center gap-1 border-primary-border border-b bg-primary p-2">
        {(["preview", "code"] as const).map((value) => (
          <button
            key={value}
            type="button"
            onClick={() => setTab(value)}
            className={cn(
              "cursor-pointer rounded-full border px-3 py-1.5 font-medium text-sm capitalize transition-colors",
              tab === value
                ? "border-primary-border bg-primary text-ink-primary shadow-xs"
                : "border-transparent text-ink-tertiary hover:text-ink-secondary",
            )}
          >
            {value}
          </button>
        ))}
      </div>
      {tab === "preview" ? (
        <div className="flex min-h-40 items-center justify-center bg-base p-8">{preview}</div>
      ) : (
        <div className="[&_pre]:max-h-[32rem] [&_pre]:rounded-none [&_pre]:border-0">{code}</div>
      )}
    </div>
  );
};
