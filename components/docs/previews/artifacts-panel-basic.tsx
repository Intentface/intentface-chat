"use client";

import { useState } from "react";
import { ArtifactsPanel } from "@/components/ai/artifacts-panel";
import Button from "@/components/ui/button";

// The side panel slides in from the right over a fixed width. Toggle it to see
// the enter/exit width animation; the header close and footer copy are wired.
export const ArtifactsPanelBasic = () => {
  const [open, setOpen] = useState(true);
  const content =
    "# Notes\n\nThe panel hosts streamed artifacts — documents, code, reports — beside the thread.";

  return (
    <div className="flex h-[320px] w-full max-w-2xl overflow-hidden rounded-xl border border-primary-border bg-base [--artifacts-panel-width:320px]">
      <div className="flex flex-1 items-center justify-center p-4">
        <Button variant="secondary" size="sm" onClick={() => setOpen((current) => !current)}>
          {open ? "Close" : "Open"} panel
        </Button>
      </div>
      <ArtifactsPanel open={open}>
        <ArtifactsPanel.Header title="notes.md" onClose={() => setOpen(false)} />
        <ArtifactsPanel.Viewport>
          <ArtifactsPanel.Content>{content}</ArtifactsPanel.Content>
        </ArtifactsPanel.Viewport>
        <ArtifactsPanel.Footer content={content} />
      </ArtifactsPanel>
    </div>
  );
};
