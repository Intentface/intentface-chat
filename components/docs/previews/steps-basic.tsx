"use client";

import { Steps } from "@/components/ai/steps";

// A collapsible timeline of work. Steps with children become expandable rows;
// leaf steps are static. Open by default so the timeline is visible at rest.
export const StepsBasic = () => (
  <div className="w-full max-w-xl">
    <Steps defaultOpen>
      <Steps.Header>Worked for 3 seconds</Steps.Header>
      <Steps.Content>
        <Steps.Step label="Read the request" status="complete" />
        <Steps.Step label="Searched the web" status="complete">
          <Steps.Body>{"Found three relevant sources and skimmed each."}</Steps.Body>
        </Steps.Step>
        <Steps.Step label="Writing the answer" status="active" />
      </Steps.Content>
    </Steps>
  </div>
);
