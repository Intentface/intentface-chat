"use client";

import { Steps } from "@/components/ai/steps";
import { ChevronDownIcon } from "@/components/icons/chevron-down";

// The recursive Steps primitive: a top-level item whose panel holds rows, and
// a nested item whose panel indents behind the rail (data-nested). Open by
// default so the timeline is visible at rest.
const Chevron = () => (
  <ChevronDownIcon className="size-4 shrink-0 transition-transform group-data-open/steps-trigger:rotate-180" />
);

export const StepsBasic = () => (
  <div className="w-full max-w-xl">
    <Steps>
      <Steps.Item defaultOpen>
        <Steps.Trigger>
          <span className="flex-1 text-left">Worked for 3 seconds</span>
          <Chevron />
        </Steps.Trigger>
        <Steps.Panel>
          <span className="py-0.5 text-sm text-ink-secondary">Read the request</span>

          <Steps.Item defaultOpen>
            <Steps.Trigger>
              <span className="flex-1 text-left">Searched the web</span>
              <Chevron />
            </Steps.Trigger>
            <Steps.Panel>
              <span className="py-0.5 text-sm text-ink-secondary">
                Found three relevant sources and skimmed each.
              </span>
            </Steps.Panel>
          </Steps.Item>

          <span className="py-0.5 text-sm font-medium text-ink-primary">Writing the answer</span>
        </Steps.Panel>
      </Steps.Item>
    </Steps>
  </div>
);
