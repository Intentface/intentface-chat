// Requests — pure state machine for the request flow. State is a current step
// plus a map of per-step drafts; every transition is an immutable map
// operation, so the store only owns the state cell and the effect execution.

import type { ComposerRequest, ComposerRequestEntry } from "./types";

// ---------------------------------------------------------------------------
// Types — the machine state plus the effect/action/transition vocabulary the
// store speaks to it in.
// ---------------------------------------------------------------------------

export type RequestDraft = {
  selected: Set<string>;
  freeText: string;
};

export type RequestState = {
  step: number;
  drafts: Map<number, RequestDraft>;
};

export const INITIAL_REQUEST_STATE: RequestState = {
  step: 0,
  drafts: new Map(),
};

// Everything a transition may ask of the outside world. The store executes
// these against the editor controller, the options handle, and the submit
// callback — the transitions below only describe them.
export type RequestEffect =
  | { type: "clear-input" }
  | { type: "set-input-text"; text: string }
  | { type: "focus-input" }
  | { type: "focus-options" }
  | { type: "reset-highlight" }
  | { type: "submit-requests"; requests: ComposerRequestEntry[] };

export type RequestAction =
  | { type: "toggle-option"; label: string }
  | { type: "select-option"; label: string }
  | { type: "clear-selections" }
  | { type: "continue-step"; freeText: string }
  | { type: "dismiss-step" }
  | { type: "step-back"; currentText: string }
  | { type: "step-forward"; currentText: string };

export type RequestTransition = {
  next: RequestState;
  effects: RequestEffect[];
};

// ---------------------------------------------------------------------------
// Draft helpers — immutable operations on the per-step draft map, plus the
// projection/query the store reads.
// ---------------------------------------------------------------------------

const emptyDraft = (): RequestDraft => ({
  selected: new Set<string>(),
  freeText: "",
});

const cloneDrafts = (source: Map<number, RequestDraft>) => new Map(source);

// Record `text` as the step's free-text answer. Single-select treats text and
// a chosen option as mutually exclusive, so any selection is dropped;
// multi-select keeps existing selections alongside the text. Empty text is a
// no-op (returns an untouched clone).
const writeFreeText = (
  drafts: Map<number, RequestDraft>,
  step: number,
  text: string,
  multiSelect: boolean,
) => {
  const next = cloneDrafts(drafts);
  if (text.length === 0) return next;
  const previous = next.get(step) ?? emptyDraft();
  next.set(step, {
    selected: multiSelect ? previous.selected : new Set(),
    freeText: text,
  });
  return next;
};

// Remove the step's draft entirely (skip / dismiss).
const skipStep = (drafts: Map<number, RequestDraft>, step: number): Map<number, RequestDraft> => {
  const next = cloneDrafts(drafts);
  next.delete(step);
  return next;
};

// Toggle an option on the step's draft. Multi-select toggles membership and
// keeps free text; single-select replaces both (option and text are mutually
// exclusive).
const toggleAnswer = (
  drafts: Map<number, RequestDraft>,
  step: number,
  label: string,
  multiSelect: boolean,
) => {
  const next = cloneDrafts(drafts);
  const previous = next.get(step) ?? emptyDraft();
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

// Project the drafts onto the public flat entry shape, one entry per request in
// order. Selected keys resolve to option values (label fallback); `text` is
// present only when the user typed something.
export const compileRequests = (
  state: RequestState,
  requests: ComposerRequest[],
): ComposerRequestEntry[] =>
  requests.map((request, index) => {
    const draft = state.drafts.get(index);
    if (!draft) return { id: request.id, selected: [] };

    const selected = [...draft.selected].map((key) => {
      const option = request.options.find((o) => o.label === key || o.value === key);
      return option ? (option.value ?? option.label) : key;
    });
    const text = draft.freeText.trim();

    return text === "" ? { id: request.id, selected } : { id: request.id, selected, text };
  });

export const isLastStep = (state: RequestState, requests: ComposerRequest[]) =>
  state.step >= requests.length - 1;

// ---------------------------------------------------------------------------
// Transitions — the decide half of the flow: map an action onto the next state
// plus the effects to run. transitionRequests is the single entry point.
// ---------------------------------------------------------------------------

// Commit `nextDrafts`, advance one step, and reset the input — then either
// arm the next request (blurred, highlight reset) or compile and submit on
// the last step (input focused for the follow-up message).
const advanceStep = (
  state: RequestState,
  requests: ComposerRequest[],
  nextDrafts: Map<number, RequestDraft>,
): RequestTransition => {
  const next: RequestState = { step: state.step + 1, drafts: nextDrafts };
  if (state.step < requests.length - 1) {
    return {
      next,
      effects: [{ type: "clear-input" }, { type: "reset-highlight" }, { type: "focus-options" }],
    };
  }
  return {
    next,
    effects: [
      { type: "clear-input" },
      { type: "submit-requests", requests: compileRequests(next, requests) },
      { type: "focus-input" },
    ],
  };
};

// Navigate to `targetStep`, preserving any in-progress free text on the step
// being left and restoring the target step's saved text into the input.
const transitionToStep = (
  state: RequestState,
  targetStep: number,
  currentText: string,
): RequestTransition => {
  if (targetStep === state.step) return { next: state, effects: [] };

  const trimmed = currentText.trim();
  const drafts = cloneDrafts(state.drafts);
  if (trimmed.length > 0) {
    const previous = drafts.get(state.step) ?? emptyDraft();
    drafts.set(state.step, { ...previous, freeText: trimmed });
  }

  const next: RequestState = { step: targetStep, drafts };
  return {
    next,
    effects: [
      { type: "set-input-text", text: drafts.get(targetStep)?.freeText ?? "" },
      { type: "reset-highlight" },
      { type: "focus-options" },
    ],
  };
};

// The decide half of the request flow, mirroring interpretRequestKey: map an
// action onto the next state plus the effects to run. Composed actions
// (select-option = toggle + advance) resolve atomically here, so no caller
// ever chains transitions across a stale state snapshot.
export const transitionRequests = (
  state: RequestState,
  requests: ComposerRequest[],
  action: RequestAction,
): RequestTransition => {
  const multiSelect = !!requests[state.step]?.multiSelect;

  switch (action.type) {
    case "toggle-option":
      return {
        next: {
          ...state,
          drafts: toggleAnswer(state.drafts, state.step, action.label, multiSelect),
        },
        effects: multiSelect ? [] : [{ type: "clear-input" }],
      };

    case "select-option": {
      const toggled = toggleAnswer(state.drafts, state.step, action.label, multiSelect);
      if (multiSelect) return { next: { ...state, drafts: toggled }, effects: [] };
      return advanceStep(state, requests, toggled);
    }

    case "clear-selections": {
      const previous = state.drafts.get(state.step);
      if (!previous || previous.selected.size === 0) return { next: state, effects: [] };
      const drafts = cloneDrafts(state.drafts);
      drafts.set(state.step, { selected: new Set(), freeText: previous.freeText });
      return { next: { ...state, drafts }, effects: [] };
    }

    case "continue-step":
      return advanceStep(
        state,
        requests,
        writeFreeText(state.drafts, state.step, action.freeText.trim(), multiSelect),
      );

    case "dismiss-step":
      return advanceStep(state, requests, skipStep(state.drafts, state.step));

    case "step-back":
      return transitionToStep(state, Math.max(0, state.step - 1), action.currentText);

    case "step-forward":
      return transitionToStep(
        state,
        Math.min(requests.length - 1, state.step + 1),
        action.currentText,
      );
  }
};
