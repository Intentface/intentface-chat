// Ask-user — pure state machine for the questionnaire flow. State is a current
// step plus a map of per-step answers; every transition is an immutable map
// operation, so the store only owns the state cell and the effect execution.

import type { AskUserQuestion, ComposerAnswerEntry } from "./types";

// ---------------------------------------------------------------------------
// Types — the machine state plus the effect/action/transition vocabulary the
// store speaks to it in.
// ---------------------------------------------------------------------------

export type AnswerEntry = {
  selected: Set<string>;
  freeText: string;
};

export type AskUserState = {
  step: number;
  answers: Map<number, AnswerEntry>;
};

export const INITIAL_ASK_USER_STATE: AskUserState = {
  step: 0,
  answers: new Map(),
};

// Everything a transition may ask of the outside world. The store executes
// these against the editor controller, the options handle, and the submit
// callback — the transitions below only describe them.
export type AskUserEffect =
  | { type: "clear-input" }
  | { type: "set-input-text"; text: string }
  | { type: "focus-input" }
  | { type: "focus-options" }
  | { type: "reset-highlight" }
  | { type: "submit-answers"; answers: ComposerAnswerEntry[] };

export type AskUserAction =
  | { type: "toggle-option"; label: string }
  | { type: "select-option"; label: string }
  | { type: "clear-selections" }
  | { type: "continue-step"; freeText: string }
  | { type: "dismiss-step" }
  | { type: "step-back"; currentText: string }
  | { type: "step-forward"; currentText: string };

export type AskUserTransition = {
  next: AskUserState;
  effects: AskUserEffect[];
};

// ---------------------------------------------------------------------------
// Answer helpers — immutable operations on the per-step answer map, plus the
// projection/query the store reads.
// ---------------------------------------------------------------------------

const emptyEntry = (): AnswerEntry => ({
  selected: new Set<string>(),
  freeText: "",
});

const cloneAnswers = (source: Map<number, AnswerEntry>) => new Map(source);

// Record `text` as the step's free-text answer. Single-select treats text and
// a chosen option as mutually exclusive, so any selection is dropped;
// multi-select keeps existing selections alongside the text. Empty text is a
// no-op (returns an untouched clone).
const writeFreeText = (
  answers: Map<number, AnswerEntry>,
  step: number,
  text: string,
  multiSelect: boolean,
) => {
  const next = cloneAnswers(answers);
  if (text.length === 0) return next;
  const previous = next.get(step) ?? emptyEntry();
  next.set(step, {
    selected: multiSelect ? previous.selected : new Set(),
    freeText: text,
  });
  return next;
};

// Remove the step's entry entirely (skip / dismiss).
const skipStep = (answers: Map<number, AnswerEntry>, step: number): Map<number, AnswerEntry> => {
  const next = cloneAnswers(answers);
  next.delete(step);
  return next;
};

// Toggle an option on the step's entry. Multi-select toggles membership and
// keeps free text; single-select replaces both (option and text are mutually
// exclusive).
const toggleAnswer = (
  answers: Map<number, AnswerEntry>,
  step: number,
  label: string,
  multiSelect: boolean,
) => {
  const next = cloneAnswers(answers);
  const previous = next.get(step) ?? emptyEntry();
  const selected = new Set(previous.selected);
  if (multiSelect) {
    if (selected.has(label)) selected.delete(label);
    else selected.add(label);
  } else {
    selected.clear();
    selected.add(label);
  }
  next.set(step, { selected, freeText: multiSelect ? previous.freeText : "" });
  return next;
};

// Project the collected answers onto the public ComposerAnswerEntry union, one
// entry per question in order. The chosen branch encodes the invariant:
// single-select carries `option` *or* `text`; multi-select carries both;
// an unanswered question is bare `{ question }`.
export const compileAnswers = (
  state: AskUserState,
  questions: AskUserQuestion[],
): ComposerAnswerEntry[] =>
  questions.map(({ question, multiSelect }, index) => {
    const entry = state.answers.get(index);
    if (!entry) return { question };

    const selected = [...entry.selected];
    const text = entry.freeText.trim();

    if (multiSelect) {
      if (selected.length === 0 && text === "") return { question };
      return { question, options: selected, text };
    }

    const firstSelected = selected[0];
    if (firstSelected !== undefined) return { question, option: firstSelected };
    if (text !== "") return { question, text };
    return { question };
  });

export const isLastStep = (state: AskUserState, questions: AskUserQuestion[]) =>
  state.step >= questions.length - 1;

// ---------------------------------------------------------------------------
// Transitions — the decide half of the flow: map an action onto the next state
// plus the effects to run. transitionAskUser is the single entry point.
// ---------------------------------------------------------------------------

// Commit `nextAnswers`, advance one step, and reset the input — then either
// arm the next question (blurred, highlight reset) or compile and submit on
// the last step (input focused for the follow-up message).
const advanceStep = (
  state: AskUserState,
  questions: AskUserQuestion[],
  nextAnswers: Map<number, AnswerEntry>,
): AskUserTransition => {
  const next: AskUserState = { step: state.step + 1, answers: nextAnswers };
  if (state.step < questions.length - 1) {
    return {
      next,
      effects: [{ type: "clear-input" }, { type: "reset-highlight" }, { type: "focus-options" }],
    };
  }
  return {
    next,
    effects: [
      { type: "clear-input" },
      { type: "submit-answers", answers: compileAnswers(next, questions) },
      { type: "focus-input" },
    ],
  };
};

// Navigate to `targetStep`, preserving any in-progress free text on the step
// being left and restoring the target step's saved text into the input.
const transitionToStep = (
  state: AskUserState,
  targetStep: number,
  currentText: string,
): AskUserTransition => {
  if (targetStep === state.step) return { next: state, effects: [] };

  const trimmed = currentText.trim();
  const answers = cloneAnswers(state.answers);
  if (trimmed.length > 0) {
    const previous = answers.get(state.step) ?? emptyEntry();
    answers.set(state.step, { ...previous, freeText: trimmed });
  }

  const next: AskUserState = { step: targetStep, answers };
  return {
    next,
    effects: [
      { type: "set-input-text", text: answers.get(targetStep)?.freeText ?? "" },
      { type: "reset-highlight" },
      { type: "focus-options" },
    ],
  };
};

// The decide half of the ask-user flow, mirroring interpretAskUserKey: map an
// action onto the next state plus the effects to run. Composed actions
// (select-option = toggle + advance) resolve atomically here, so no caller
// ever chains transitions across a stale state snapshot.
export const transitionAskUser = (
  state: AskUserState,
  questions: AskUserQuestion[],
  action: AskUserAction,
): AskUserTransition => {
  const multiSelect = !!questions[state.step]?.multiSelect;

  switch (action.type) {
    case "toggle-option":
      return {
        next: {
          ...state,
          answers: toggleAnswer(state.answers, state.step, action.label, multiSelect),
        },
        effects: multiSelect ? [] : [{ type: "clear-input" }],
      };

    case "select-option": {
      const toggled = toggleAnswer(state.answers, state.step, action.label, multiSelect);
      if (multiSelect) return { next: { ...state, answers: toggled }, effects: [] };
      return advanceStep(state, questions, toggled);
    }

    case "clear-selections": {
      const previous = state.answers.get(state.step);
      if (!previous || previous.selected.size === 0) return { next: state, effects: [] };
      const answers = cloneAnswers(state.answers);
      answers.set(state.step, { selected: new Set(), freeText: previous.freeText });
      return { next: { ...state, answers }, effects: [] };
    }

    case "continue-step":
      return advanceStep(
        state,
        questions,
        writeFreeText(state.answers, state.step, action.freeText.trim(), multiSelect),
      );

    case "dismiss-step":
      return advanceStep(state, questions, skipStep(state.answers, state.step));

    case "step-back":
      return transitionToStep(state, Math.max(0, state.step - 1), action.currentText);

    case "step-forward":
      return transitionToStep(
        state,
        Math.min(questions.length - 1, state.step + 1),
        action.currentText,
      );
  }
};
