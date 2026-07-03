"use client";

// Composer.AskUser / AskUserHints / AskUserDismiss / AskUserContinue —
// default renders for the ask-user flow armed via the Root `questions` prop.
// These compose the headless AskUser primitives and read the store; the
// styled layer ships its own versions with Kbd/Button chrome.

import { type ComponentProps, useRef } from "react";
import { AskUser } from "../ask-user";
import { useComposer } from "./store";

export const ComposerAskUser = () => {
  const askUser = useComposer((composer) => composer.askUser);

  const question = askUser.questions?.[askUser.step] ?? null;
  const lastQuestionRef = useRef(question);
  if (question) lastQuestionRef.current = question;
  const display = question ?? lastQuestionRef.current;

  if (!display) return null;

  const entry = askUser.answers.get(askUser.step) ?? {
    selected: new Set<string>(),
    freeText: "",
  };

  const totalQuestions = askUser.questions?.length ?? 0;

  return (
    <AskUser>
      <AskUser.Header>
        <AskUser.Label>{display.question}</AskUser.Label>
        {!askUser.isSingle && totalQuestions > 1 && (
          <AskUser.Navigation>
            <AskUser.Previous onClick={askUser.goBack} disabled={askUser.step === 0} />
            <AskUser.StepLabel current={askUser.step + 1} total={totalQuestions} />
            <AskUser.Next onClick={askUser.goNext} disabled={askUser.step === totalQuestions - 1} />
          </AskUser.Navigation>
        )}
      </AskUser.Header>
      {display.options && (
        <AskUser.Options
          ref={askUser.optionsRef}
          multiSelect={!!display.multiSelect}
          groupName={`q-${askUser.step}`}
        >
          {display.options.map((option) => (
            <AskUser.Option
              key={option.label}
              value={option.label}
              selected={entry.selected.has(option.label)}
              onSelect={() => askUser.toggleOption(option.label)}
            >
              <AskUser.OptionContent>
                <AskUser.OptionLabel>{option.label}</AskUser.OptionLabel>
                {option.description && (
                  <AskUser.OptionDescription>{option.description}</AskUser.OptionDescription>
                )}
              </AskUser.OptionContent>
            </AskUser.Option>
          ))}
        </AskUser.Options>
      )}
    </AskUser>
  );
};

export type ComposerAskUserHintsProps = ComponentProps<typeof AskUser.Hints>;

export const ComposerAskUserHints = ({ children, ...props }: ComposerAskUserHintsProps) => {
  const askUser = useComposer((composer) => composer.askUser);
  const totalQuestions = askUser.questions?.length ?? 0;

  return (
    <AskUser.Hints {...props}>
      {children ?? (
        <>
          <span>↑↓ navigate</span>
          <span>↵ select</span>
          {!askUser.isSingle && totalQuestions > 1 && <span>←→ between questions</span>}
          <span>esc skip</span>
        </>
      )}
    </AskUser.Hints>
  );
};

export type ComposerAskUserDismissProps = ComponentProps<"button">;

export const ComposerAskUserDismiss = ({ children, ...props }: ComposerAskUserDismissProps) => {
  const askUser = useComposer((composer) => composer.askUser);
  return (
    <button
      type="button"
      data-slot="composer-ask-user-dismiss"
      onClick={askUser.dismissStep}
      {...props}
    >
      {children ?? "Dismiss"}
    </button>
  );
};

export type ComposerAskUserContinueProps = ComponentProps<"button">;

export const ComposerAskUserContinue = ({ children, ...props }: ComposerAskUserContinueProps) => {
  const askUser = useComposer((composer) => composer.askUser);
  return (
    <button type="submit" data-slot="composer-ask-user-continue" {...props}>
      {children ?? (askUser.isLastStep ? "Submit" : "Continue")}
    </button>
  );
};
