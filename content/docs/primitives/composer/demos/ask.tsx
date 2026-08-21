"use client";

import { Ask } from "@intentface/ui/ask";
import { useComposer } from "@intentface/ui/composer";

// The parts are structural; the current request and selections come from the
// composer's requests slice.
export const Prompt = () => {
  const requests = useComposer((composer) => composer.requests);
  const request = requests.items?.[requests.step];

  if (!request) return null;

  const draft = requests.drafts.get(requests.step);
  const total = requests.items?.length ?? 0;

  return (
    <Ask.Root className="flex flex-col gap-0.5 p-1">
      <Ask.Header className="flex h-[34px] items-center gap-2 pr-1 pl-2.5">
        <Ask.Label className="font-medium text-[13px] text-zinc-900 dark:text-zinc-100">
          {request.label}
        </Ask.Label>
        {!requests.isSingle && total > 1 && (
          <Ask.Navigation className="ml-auto flex items-center gap-0.5 text-zinc-400 dark:text-zinc-500">
            <Ask.Previous
              onClick={requests.goBack}
              disabled={requests.step === 0}
              aria-label="Previous question"
              className={STEP_BUTTON_CLASS}
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
              className={STEP_BUTTON_CLASS}
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
            const selected = Boolean(draft?.selected.has(option.label));
            return (
              <Ask.Option
                key={option.label}
                value={option.label}
                selected={selected}
                onSelect={() => requests.toggleOption(option.label)}
                className="flex cursor-pointer items-start gap-2.5 rounded-lg px-2.5 py-2 outline-none transition-colors data-highlighted:bg-zinc-950/5 dark:data-highlighted:bg-white/8"
              >
                {/* Decorative: the Option itself carries the radio/checkbox role. */}
                <span
                  aria-hidden="true"
                  className={`mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-[5px] text-[10px] ${
                    selected
                      ? "bg-[#0169cc] bg-linear-to-b from-[oklch(57.2%_0.166_253.2)] to-[oklch(52.9%_0.173_255)] text-white shadow-[inset_0_1px_0_rgb(255_255_255/0.28),0_0_0_1px_oklch(46.5%_0.146_254.8),0_1px_2px_rgb(1_105_204/0.35)]"
                      : "bg-white bg-linear-to-b from-white to-[#fdfdfd] shadow-[inset_0_1px_0_#fff,0_0_0_1px_rgb(0_0_0/0.075),0_1px_2px_rgb(0_0_0/0.07),0_2px_6px_-2px_rgb(0_0_0/0.05)] dark:bg-[#2d2d30] dark:from-[#313134] dark:to-[#2a2a2d] dark:shadow-[inset_0_1px_0_rgb(255_255_255/0.1),inset_0_0_0_1px_rgb(255_255_255/0.05),0_0_0_1px_rgb(0_0_0/0.16),0_1px_2px_rgb(0_0_0/0.1)]"
                  }`}
                >
                  {selected ? "✓" : ""}
                </span>
                <Ask.OptionContent className="flex flex-col gap-0.5">
                  <Ask.OptionLabel className="font-medium text-[13px] text-zinc-900 leading-5 dark:text-zinc-100">
                    {option.label}
                  </Ask.OptionLabel>
                  {option.description && (
                    <Ask.OptionDescription className="text-xs text-zinc-500 dark:text-zinc-400">
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
export const Controls = () => {
  const requests = useComposer((composer) => composer.requests);

  return (
    <>
      <Ask.Dismiss
        onClick={requests.dismissStep}
        className="h-7 cursor-pointer rounded-full px-3 font-medium text-[13px] text-zinc-500 transition-colors hover:bg-zinc-950/5 hover:text-zinc-900 focus-visible:outline-2 focus-visible:outline-[#0169cc]/60 focus-visible:outline-offset-2 dark:text-zinc-400 dark:hover:bg-white/8 dark:hover:text-zinc-100"
      >
        Skip
      </Ask.Dismiss>
      <Ask.Continue className="h-7 cursor-pointer rounded-full bg-[#0169cc] bg-linear-to-b from-[oklch(57.2%_0.166_253.2)] to-[oklch(52.9%_0.173_255)] shadow-[inset_0_1px_0_rgb(255_255_255/0.28),0_0_0_1px_oklch(46.5%_0.146_254.8),0_1px_2px_rgb(1_105_204/0.35)] px-3 font-medium text-[13px] text-white transition-opacity focus-visible:outline-2 focus-visible:outline-[#0169cc]/60 focus-visible:outline-offset-2 disabled:cursor-default disabled:opacity-40">
        {requests.isLastStep ? "Done" : "Continue"}
      </Ask.Continue>
    </>
  );
};

const STEP_BUTTON_CLASS =
  "flex size-6 cursor-pointer items-center justify-center rounded-full transition-colors hover:bg-zinc-950/5 hover:text-zinc-900 focus-visible:outline-2 focus-visible:outline-[#0169cc]/60 focus-visible:outline-offset-2 disabled:pointer-events-none disabled:opacity-30 dark:hover:bg-white/8 dark:hover:text-zinc-100";
