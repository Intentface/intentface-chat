"use client";

// Composer.AskUser / AskUserHints / AskUserDismiss / AskUserContinue —
// default renders for the ask-user flow armed via the Root `questions` prop.
// These compose the headless AskUser primitives and read the store; the
// styled layer ships its own versions with Kbd/Button chrome.

import { type ComponentProps, useRef } from "react";
import { AskUser } from "../ask-user";
import type { PrimitiveProps } from "../internal/primitive-props";
import { useRenderElement } from "../internal/render/useRenderElement";
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

// Structural slot only — the keyboard-hint copy is the consumer's. Read
// `useComposer((c) => c.askUser)` in your children to branch on step count.
export const ComposerAskUserHints = (props: ComposerAskUserHintsProps) => (
  <AskUser.Hints {...props} />
);

export type ComposerAskUserDismissProps = PrimitiveProps<"button">;

export const ComposerAskUserDismiss = ({
  children,
  className,
  render,
  style,
  ...elementProps
}: ComposerAskUserDismissProps) => {
  const askUser = useComposer((composer) => composer.askUser);

  return useRenderElement(
    "button",
    { className, render, style },
    {
      props: [
        {
          "data-slot": "composer-ask-user-dismiss",
          onClick: askUser.dismissStep,
          children,
        },
        elementProps,
      ],
    },
  );
};

export type ComposerAskUserContinueProps = PrimitiveProps<"button">;

// Structural slot only — supply the label yourself (read
// `useComposer((c) => c.askUser.isLastStep)` to switch continue/submit copy).
export const ComposerAskUserContinue = ({
  children,
  className,
  render,
  style,
  ...elementProps
}: ComposerAskUserContinueProps) =>
  useRenderElement(
    "button",
    { className, render, style },
    {
      props: [
        {
          type: "submit" as const,
          "data-slot": "composer-ask-user-continue",
          children,
        },
        elementProps,
      ],
    },
  );
