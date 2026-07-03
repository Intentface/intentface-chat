import { describe, expect, test } from "bun:test";
import {
  type AskUserState,
  compileAnswers,
  INITIAL_ASK_USER_STATE,
  isLastStep,
  transitionAskUser,
} from "../src/composer/ask-user-machine";
import type { AskUserQuestion } from "../src/types";

const questions: AskUserQuestion[] = [
  { question: "Q1?", options: [{ label: "A", description: "a" }] },
  {
    question: "Q2?",
    options: [
      { label: "B", description: "b" },
      { label: "C", description: "c" },
    ],
    multiSelect: true,
  },
];

describe("transitionAskUser", () => {
  test("select-option on single-select advances a step and clears input", () => {
    const { next, effects } = transitionAskUser(INITIAL_ASK_USER_STATE, questions, {
      type: "select-option",
      label: "A",
    });

    expect(next.step).toBe(1);
    expect(next.answers.get(0)?.selected.has("A")).toBe(true);
    expect(effects.map((e) => e.type)).toEqual(["clear-input", "reset-highlight", "blur-input"]);
  });

  test("select-option on the last step compiles and submits", () => {
    const onLast: AskUserState = { step: 1, answers: new Map() };
    const { next, effects } = transitionAskUser(onLast, questions, {
      type: "select-option",
      label: "B",
    });

    // Multi-select never auto-advances on select — it toggles.
    expect(next.step).toBe(1);
    expect(effects).toEqual([]);
    expect(next.answers.get(1)?.selected.has("B")).toBe(true);
  });

  test("continue-step on the last step emits submit-answers with compiled payload", () => {
    const state: AskUserState = {
      step: 1,
      answers: new Map([[0, { selected: new Set(["A"]), freeText: "" }]]),
    };
    const withToggle = transitionAskUser(state, questions, { type: "toggle-option", label: "B" });
    const { effects } = transitionAskUser(withToggle.next, questions, {
      type: "continue-step",
      freeText: "extra context",
    });

    const submit = effects.find((e) => e.type === "submit-answers");
    expect(submit).toBeDefined();
    if (submit?.type !== "submit-answers") throw new Error("unreachable");
    expect(submit.answers).toEqual([
      { question: "Q1?", option: "A" },
      { question: "Q2?", options: ["B"], text: "extra context" },
    ]);
    expect(effects.at(-1)).toEqual({ type: "focus-input" });
  });

  test("multiSelect toggle flips membership and keeps free text", () => {
    const first = transitionAskUser({ step: 1, answers: new Map() }, questions, {
      type: "toggle-option",
      label: "B",
    });
    const second = transitionAskUser(first.next, questions, { type: "toggle-option", label: "B" });
    expect(second.next.answers.get(1)?.selected.size).toBe(0);
  });

  test("dismiss-step skips the answer entirely", () => {
    const { next } = transitionAskUser(INITIAL_ASK_USER_STATE, questions, {
      type: "dismiss-step",
    });
    expect(next.step).toBe(1);
    expect(next.answers.has(0)).toBe(false);
  });

  test("step-back preserves in-progress free text and restores the target's", () => {
    const state: AskUserState = {
      step: 1,
      answers: new Map([[0, { selected: new Set(), freeText: "saved" }]]),
    };
    const { next, effects } = transitionAskUser(state, questions, {
      type: "step-back",
      currentText: "typing on q2",
    });

    expect(next.step).toBe(0);
    expect(next.answers.get(1)?.freeText).toBe("typing on q2");
    expect(effects[0]).toEqual({ type: "set-input-text", text: "saved" });
  });

  test("step navigation clamps at the ends", () => {
    const atStart = transitionAskUser(INITIAL_ASK_USER_STATE, questions, {
      type: "step-back",
      currentText: "",
    });
    expect(atStart.next).toBe(INITIAL_ASK_USER_STATE);
    expect(atStart.effects).toEqual([]);
  });
});

describe("compileAnswers", () => {
  test("unanswered questions compile to bare entries", () => {
    expect(compileAnswers(INITIAL_ASK_USER_STATE, questions)).toEqual([
      { question: "Q1?" },
      { question: "Q2?" },
    ]);
  });

  test("free text on single-select compiles to text entry", () => {
    const state: AskUserState = {
      step: 0,
      answers: new Map([[0, { selected: new Set(), freeText: " custom " }]]),
    };
    expect(compileAnswers(state, questions)[0]).toEqual({ question: "Q1?", text: "custom" });
  });
});

describe("isLastStep", () => {
  test("reports the final question", () => {
    expect(isLastStep({ step: 0, answers: new Map() }, questions)).toBe(false);
    expect(isLastStep({ step: 1, answers: new Map() }, questions)).toBe(true);
  });
});
