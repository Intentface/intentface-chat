"use client";

import { Steps } from "@/components/ai/steps";
import { CheckMarkMediumIcon } from "@/components/icons/check-mark-medium";
import { ChevronDownIcon } from "@/components/icons/chevron-down";
import { CircleIcon } from "@/components/icons/circle";

// The recursive Steps primitive: a top-level item whose panel holds rows, and
// a nested item whose panel indents behind the rail (data-nested). Open by
// default so the timeline is visible at rest.
const Chevron = () => (
  <ChevronDownIcon className="size-4 shrink-0 -rotate-90 transition-transform group-data-open/steps-trigger:rotate-0" />
);

export const StepsBasic = () => (
  <div className="w-full max-w-xl">
    <Steps>
      <Steps.Item defaultOpen>
        <Steps.Trigger>
          <span>Worked for 3 seconds</span>
          <Chevron />
        </Steps.Trigger>
        <Steps.Panel>
          <div className="flex items-center gap-2 py-0.5">
            <Steps.Icon>
              <CheckMarkMediumIcon className="size-3.5" />
            </Steps.Icon>
            <Steps.Label>Read the request</Steps.Label>
          </div>

          <Steps.Item defaultOpen>
            <Steps.Trigger className="py-0.5">
              <Steps.Icon className="relative">
                <span className="transition-opacity group-hover/steps-trigger:opacity-0 group-data-open/steps-trigger:opacity-0">
                  <CheckMarkMediumIcon className="size-3.5" />
                </span>
                <ChevronDownIcon className="absolute size-4 -rotate-90 opacity-0 transition-all group-hover/steps-trigger:opacity-100 group-data-open/steps-trigger:rotate-0 group-data-open/steps-trigger:opacity-100" />
              </Steps.Icon>
              <Steps.Label>Searched the web</Steps.Label>
            </Steps.Trigger>
            <Steps.Panel className="mt-0">
              <span className="py-0.5 text-sm text-ink-secondary">
                Found three relevant sources and skimmed each.
              </span>
            </Steps.Panel>
          </Steps.Item>

          <div className="flex items-center gap-2 py-0.5">
            <Steps.Icon status="active">
              <CircleIcon className="size-3.5 animate-pulse" />
            </Steps.Icon>
            <Steps.Label status="active">Writing the answer</Steps.Label>
          </div>
        </Steps.Panel>
      </Steps.Item>
    </Steps>
  </div>
);
