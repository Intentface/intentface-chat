"use client";

import { AskUser } from "@intentface/chat/ask-user";
import {
  type AskUserQuestion,
  Composer,
  type ComposerSubmitData,
  useComposer,
} from "@intentface/chat/composer";
import { type ComponentProps, useState } from "react";

// Setting `questions` arms the flow and flips askUser.active. Answering or
// skipping the last one fires onSubmit with { kind: "answers" }.
const QUESTIONS: AskUserQuestion[] = [
  {
    question: "Which framework are you deploying to?",
    options: [
      { label: "Next.js", description: "App Router on Vercel." },
      { label: "Vite", description: "SPA on any static host." },
      { label: "Remix", description: "Full-stack on a Node server." },
    ],
  },
  {
    question: "Which features do you need?",
    multiSelect: true,
    options: [
      { label: "Auth", description: "Sessions and sign-in." },
      { label: "Database", description: "Persistent storage." },
      { label: "File uploads", description: "Attachments and media." },
    ],
  },
  {
    question: "What matters most for this project?",
    options: [
      { label: "Speed", description: "Ship as fast as possible." },
      { label: "Scale", description: "Handle heavy traffic." },
      { label: "Cost", description: "Keep the bill low." },
    ],
  },
];

export const AskUserFlow = () => {
  const [questions, setQuestions] = useState<AskUserQuestion[]>(QUESTIONS);
  const [done, setDone] = useState(false);

  const handleSubmit = (data: ComposerSubmitData) => {
    if (data.kind === "answers") setDone(true);
  };

  const reset = () => {
    setDone(false);
    setQuestions([...QUESTIONS]);
  };

  return (
    // Reserve height and bottom-anchor so the panel opening never shifts the page.
    <div className="flex min-h-[440px] w-full max-w-xl flex-col items-center justify-end gap-3">
      <Composer.Root
        questions={done ? undefined : questions}
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

// The parts are structural; the current question and selections come from the
// composer's askUser slice.
const Prompt = () => {
  const askUser = useComposer((composer) => composer.askUser);
  const question = askUser.questions?.[askUser.step];

  if (!question) return null;

  const entry = askUser.answers.get(askUser.step);
  const total = askUser.questions?.length ?? 0;

  return (
    <AskUser.Root className="flex flex-col gap-1 p-2">
      <AskUser.Header className="flex h-7 items-center gap-2 px-2">
        <AskUser.Label className="text-sm font-medium">{question.question}</AskUser.Label>
        {!askUser.isSingle && total > 1 && (
          <AskUser.Navigation className="ml-auto flex items-center gap-1 text-[#949494] dark:text-[#6f6f6f]">
            <AskUser.Previous
              onClick={askUser.goBack}
              disabled={askUser.step === 0}
              aria-label="Previous question"
              className="cursor-pointer rounded-md px-1.5 disabled:opacity-30"
            >
              ‹
            </AskUser.Previous>
            <AskUser.StepLabel className="text-xs tabular-nums">
              {({ current, total: count }) => `${current} of ${count}`}
            </AskUser.StepLabel>
            <AskUser.Next
              onClick={askUser.goNext}
              disabled={askUser.step === total - 1}
              aria-label="Next question"
              className="cursor-pointer rounded-md px-1.5 disabled:opacity-30"
            >
              ›
            </AskUser.Next>
          </AskUser.Navigation>
        )}
      </AskUser.Header>
      {question.options && (
        <AskUser.Options
          ref={askUser.optionsRef}
          multiSelect={Boolean(question.multiSelect)}
          groupName={`question-${askUser.step}`}
          className="flex flex-col"
        >
          {question.options.map((option) => {
            const selected = Boolean(entry?.selected.has(option.label));
            return (
              <AskUser.Option
                key={option.label}
                value={option.label}
                selected={selected}
                onSelect={() => askUser.toggleOption(option.label)}
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
                <AskUser.OptionContent className="flex flex-col gap-0.5">
                  <AskUser.OptionLabel className="text-sm leading-tight">
                    {option.label}
                  </AskUser.OptionLabel>
                  {option.description && (
                    <AskUser.OptionDescription className="text-xs text-[#949494] dark:text-[#6f6f6f]">
                      {option.description}
                    </AskUser.OptionDescription>
                  )}
                </AskUser.OptionContent>
              </AskUser.Option>
            );
          })}
        </AskUser.Options>
      )}
    </AskUser.Root>
  );
};

// Dismiss is a plain button you wire up; Continue is type=submit, so the
// enclosing Composer.Root form drives it.
const Controls = () => {
  const askUser = useComposer((composer) => composer.askUser);

  return (
    <>
      <AskUser.Dismiss
        onClick={askUser.dismissStep}
        className="cursor-pointer rounded-full px-3 py-1.5 text-sm text-[#949494] transition-colors hover:bg-[#f4f4f4] hover:text-[#1a1a1a] dark:text-[#6f6f6f] dark:hover:bg-[#232323] dark:hover:text-[#fcfcfc]"
      >
        Skip
      </AskUser.Dismiss>
      <AskUser.Continue className="cursor-pointer rounded-full bg-[#1a1a1a] px-3.5 py-1.5 text-sm font-medium text-white dark:bg-[#fcfcfc] dark:text-[#111111]">
        {askUser.isLastStep ? "Done" : "Continue"}
      </AskUser.Continue>
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
