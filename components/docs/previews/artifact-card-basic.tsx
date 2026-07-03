"use client";

import { useState } from "react";
import { ArtifactCard } from "@/components/ai/artifact-card";

// An inline handle for a generated artifact. A streaming card (state
// "input-streaming") is disabled with a spinner; a settled card is clickable.
export const ArtifactCardBasic = () => {
  const [opened, setOpened] = useState<string | null>(null);

  return (
    <div className="flex w-full max-w-sm flex-col gap-3">
      <ArtifactCard
        title="Q3 Revenue Report"
        state="output-available"
        onToggle={() => setOpened((current) => (current ? null : "Q3 Revenue Report"))}
      />
      <ArtifactCard title="Draft in progress" state="input-streaming" onToggle={() => {}} />
      {opened && (
        <p className="text-ink-tertiary text-sm">
          Opened “{opened}” — wire <code>onToggle</code> to your artifacts panel.
        </p>
      )}
    </div>
  );
};
