"use client";

import { Ask } from "@intentface/chat/ask";
import {
  Composer,
  type ComposerRequest,
  type ComposerSubmitData,
  useComposer,
} from "@intentface/chat/composer";
import { type ComponentProps, useState } from "react";

// Setting `requests` arms the flow and flips requests.active. Answering or
// skipping the last one fires onSubmit with { kind: "requests" } — entries
// keyed by the ids minted here, carrying option values (label fallback).
const REQUESTS: ComposerRequest[] = [
  {
    id: "framework",
    label: "Which framework are you deploying to?",
    options: [
      { value: "next", label: "Next.js", description: "App Router on Vercel." },
      { value: "vite", label: "Vite", description: "SPA on any static host." },
      { value: "remix", label: "Remix", description: "Full-stack on a Node server." },
    ],
  },
  {
    id: "features",
    label: "Which features do you need?",
    multiSelect: true,
    options: [
      { value: "auth", label: "Auth", description: "Sessions and sign-in." },
      { value: "database", label: "Database", description: "Persistent storage." },
      { value: "uploads", label: "File uploads", description: "Attachments and media." },
    ],
  },
  {
    id: "priority",
    label: "What matters most for this project?",
    options: [
      { value: "speed", label: "Speed", description: "Ship as fast as possible." },
      { value: "scale", label: "Scale", description: "Handle heavy traffic." },
      { value: "cost", label: "Cost", description: "Keep the bill low." },
    ],
  },
];

export const AskFlow = () => {
  const [requests, setRequests] = useState<ComposerRequest[]>(REQUESTS);
  const [done, setDone] = useState(false);

  const handleSubmit = (data: ComposerSubmitData) => {
    if (data.kind === "requests") setDone(true);
  };

  const reset = () => {
    setDone(false);
    setRequests([...REQUESTS]);
  };

  return (
    // Reserve height and bottom-anchor so the panel opening never shifts the page.
    <div className="flex min-h-[440px] w-full max-w-xl flex-col items-center justify-end gap-3">
      <Composer.Root
        requests={done ? undefined : requests}
        onSubmit={handleSubmit}
        className="flex w-full flex-col"
      >
        {/* anchor={false} makes the panel an in-flow block that grows the
            composer upward; the default is a portaled overlay. */}
        <Composer.Panel
          anchor={false}
          className="mb-2 overflow-hidden rounded-2xl border border-[#f0f0f0] bg-white dark:border-[#262626] dark:bg-[#181818]"
        >
          {!done && <Prompt />}
        </Composer.Panel>
        <Composer.Container className="cursor-text rounded-2xl border border-[#f0f0f0] bg-white shadow-xs transition-colors focus-within:border-[#ececec] dark:border-[#262626] dark:bg-[#181818] dark:focus-within:border-[#2d2d2d]">
          <Composer.Textarea className="max-h-32 min-h-8 overflow-y-auto px-4 pt-3 text-sm **:data-composer-editor:w-full **:data-composer-editor:max-w-none **:data-composer-editor:leading-[1.7] [&_[data-composer-editor]:focus]:outline-none">
            <Composer.Placeholder
              placeholder={done ? "All set — reset to try again" : "Or type your own answer…"}
              className="leading-[1.7] text-[#949494] dark:text-[#6f6f6f]"
            />
          </Composer.Textarea>
          <Composer.Actions className="flex items-center justify-end gap-2 p-2">
            {done ? (
              <Composer.Submit className="flex size-8 items-center justify-center rounded-full bg-[#1a1a1a] text-white transition-opacity disabled:opacity-40 dark:bg-[#fcfcfc] dark:text-[#111111]">
                <SendIcon />
              </Composer.Submit>
            ) : (
              <Controls />
            )}
          </Composer.Actions>
        </Composer.Container>
      </Composer.Root>
      {done && (
        <button
          type="button"
          onClick={reset}
          className="cursor-pointer rounded-full border border-[#f0f0f0] bg-white px-4 py-1.5 text-sm font-medium text-[#686868] transition-colors hover:bg-[#fafafa] dark:border-[#262626] dark:bg-[#181818] dark:text-[#9b9b9b] dark:hover:bg-[#232323]"
        >
          Reset questions
        </button>
      )}
    </div>
  );
};

// The parts are structural; the current request and selections come from the
// composer's requests slice.
const Prompt = () => {
  const requests = useComposer((composer) => composer.requests);
  const request = requests.items?.[requests.step];

  if (!request) return null;

  const draft = requests.drafts.get(requests.step);
  const total = requests.items?.length ?? 0;

  return (
    <Ask.Root className="flex flex-col gap-1 p-2">
      <Ask.Header className="flex h-7 items-center gap-2 px-2">
        <Ask.Label className="text-sm font-medium">{request.label}</Ask.Label>
        {!requests.isSingle && total > 1 && (
          <Ask.Navigation className="ml-auto flex items-center gap-1 text-[#949494] dark:text-[#6f6f6f]">
            <Ask.Previous
              onClick={requests.goBack}
              disabled={requests.step === 0}
              aria-label="Previous question"
              className="cursor-pointer rounded-md px-1.5 disabled:opacity-30"
            >
              ‹
            </Ask.Previous>
            <Ask.StepLabel className="text-xs tabular-nums">
              {({ current, total: count }) => `${current} of ${count}`}
            </Ask.StepLabel>
            <Ask.Next
              onClick={requests.goNext}
              disabled={requests.step === total - 1}
              aria-label="Next question"
              className="cursor-pointer rounded-md px-1.5 disabled:opacity-30"
            >
              ›
            </Ask.Next>
          </Ask.Navigation>
        )}
      </Ask.Header>
      {request.options && (
        <Ask.Options
          ref={requests.optionsRef}
          multiSelect={Boolean(request.multiSelect)}
          groupName={`request-${requests.step}`}
          className="flex flex-col"
        >
          {request.options.map((option) => {
            const optionValue = option.value ?? option.label;
            const selected = Boolean(draft?.selected.has(optionValue));
            return (
              <Ask.Option
                key={optionValue}
                value={optionValue}
                selected={selected}
                onSelect={() => requests.toggleOption(optionValue)}
                className="flex cursor-pointer items-start gap-2 rounded-[10px] p-2 outline-none transition-colors data-highlighted:bg-[#f4f4f4] dark:data-highlighted:bg-[#232323]"
              >
                {/* Decorative: the Option itself carries the radio/checkbox role. */}
                <span
                  aria-hidden="true"
                  className={`mt-px flex size-4 shrink-0 items-center justify-center rounded border text-[10px] ${
                    selected
                      ? "border-[#1a1a1a] bg-[#1a1a1a] text-white dark:border-[#fcfcfc] dark:bg-[#fcfcfc] dark:text-[#111111]"
                      : "border-[#ececec] dark:border-[#2d2d2d]"
                  }`}
                >
                  {selected ? "✓" : ""}
                </span>
                <Ask.OptionContent className="flex flex-col gap-0.5">
                  <Ask.OptionLabel className="text-sm leading-tight">
                    {option.label}
                  </Ask.OptionLabel>
                  {option.description && (
                    <Ask.OptionDescription className="text-xs text-[#949494] dark:text-[#6f6f6f]">
                      {option.description}
                    </Ask.OptionDescription>
                  )}
                </Ask.OptionContent>
              </Ask.Option>
            );
          })}
        </Ask.Options>
      )}
    </Ask.Root>
  );
};

// Dismiss is a plain button you wire up; Continue is type=submit, so the
// enclosing Composer.Root form drives it.
const Controls = () => {
  const requests = useComposer((composer) => composer.requests);

  return (
    <>
      <Ask.Dismiss
        onClick={requests.dismissStep}
        className="cursor-pointer rounded-full px-3 py-1.5 text-sm text-[#949494] transition-colors hover:bg-[#f4f4f4] hover:text-[#1a1a1a] dark:text-[#6f6f6f] dark:hover:bg-[#232323] dark:hover:text-[#fcfcfc]"
      >
        Skip
      </Ask.Dismiss>
      <Ask.Continue className="cursor-pointer rounded-full bg-[#1a1a1a] px-3.5 py-1.5 text-sm font-medium text-white dark:bg-[#fcfcfc] dark:text-[#111111]">
        {requests.isLastStep ? "Done" : "Continue"}
      </Ask.Continue>
    </>
  );
};

const SendIcon = (props: ComponentProps<"svg">) => (
  <svg
    width="16"
    height="16"
    viewBox="0 0 16 16"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.5"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
    {...props}
  >
    <path d="M8 13V3m0 0L3.5 7.5M8 3l4.5 4.5" />
  </svg>
);
