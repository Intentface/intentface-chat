"use client";

import { CircleIcon } from "lucide-react";
import { StepQueue } from "@/components/ai/step-queue";

// The live step stack the composer shows while a run is in flight. Collapsed it
// masks to the last item; expanded it caps at five. The active label shimmers.
export const StepQueueBasic = () => (
  <div className="w-full max-w-md rounded-xl border border-primary-border bg-secondary">
    <StepQueue defaultOpen>
      <StepQueue.Item>
        <StepQueue.Icon>
          <CircleIcon className="size-2.5" />
        </StepQueue.Icon>
        <StepQueue.Label>Read the codebase</StepQueue.Label>
      </StepQueue.Item>
      <StepQueue.Item>
        <StepQueue.Icon>
          <CircleIcon className="size-2.5" />
        </StepQueue.Icon>
        <StepQueue.Label>Ran the test suite</StepQueue.Label>
      </StepQueue.Item>
      <StepQueue.Item>
        <StepQueue.Icon>
          <CircleIcon className="size-2.5" />
        </StepQueue.Icon>
        <StepQueue.Label active>Writing the summary</StepQueue.Label>
      </StepQueue.Item>
    </StepQueue>
  </div>
);
