import { describe, expect, test } from "bun:test";
import {
  compileRequests,
  INITIAL_REQUEST_STATE,
  isLastStep,
  type RequestState,
  transitionRequests,
} from "../src/composer/request-machine";
import type { ComposerRequest } from "../src/composer/types";

const requests: ComposerRequest[] = [
  { id: "q1", label: "Q1?", options: [{ label: "A", description: "a" }] },
  {
    id: "q2",
    label: "Q2?",
    options: [
      { label: "B", description: "b" },
      { label: "C", description: "c" },
    ],
    multiSelect: true,
  },
];

describe("transitionRequests", () => {
  test("select-option on single-select advances a step and clears input", () => {
    const { next, effects } = transitionRequests(INITIAL_REQUEST_STATE, requests, {
      type: "select-option",
      label: "A",
    });

    expect(next.step).toBe(1);
    expect(next.drafts.get(0)?.selected.has("A")).toBe(true);
    expect(effects.map((e) => e.type)).toEqual(["clear-input", "reset-highlight", "focus-options"]);
  });

  test("select-option on the last step compiles and submits", () => {
    const onLast: RequestState = { step: 1, drafts: new Map() };
    const { next, effects } = transitionRequests(onLast, requests, {
      type: "select-option",
      label: "B",
    });

    // Multi-select never auto-advances on select — it toggles.
    expect(next.step).toBe(1);
    expect(effects).toEqual([]);
    expect(next.drafts.get(1)?.selected.has("B")).toBe(true);
  });

  test("continue-step on the last step emits submit-requests with compiled payload", () => {
    const state: RequestState = {
      step: 1,
      drafts: new Map([[0, { selected: new Set(["A"]), freeText: "" }]]),
    };
    const withToggle = transitionRequests(state, requests, { type: "toggle-option", label: "B" });
    const { effects } = transitionRequests(withToggle.next, requests, {
      type: "continue-step",
      freeText: "extra context",
    });

    const submit = effects.find((e) => e.type === "submit-requests");
    expect(submit).toBeDefined();
    if (submit?.type !== "submit-requests") throw new Error("unreachable");
    expect(submit.requests).toEqual([
      { id: "q1", selected: ["A"] },
      { id: "q2", selected: ["B"], text: "extra context" },
    ]);
    expect(effects.at(-1)).toEqual({ type: "focus-input" });
  });

  test("multiSelect toggle flips membership and keeps free text", () => {
    const first = transitionRequests({ step: 1, drafts: new Map() }, requests, {
      type: "toggle-option",
      label: "B",
    });
    const second = transitionRequests(first.next, requests, { type: "toggle-option", label: "B" });
    expect(second.next.drafts.get(1)?.selected.size).toBe(0);
  });

  test("dismiss-step skips the draft entirely", () => {
    const { next } = transitionRequests(INITIAL_REQUEST_STATE, requests, {
      type: "dismiss-step",
    });
    expect(next.step).toBe(1);
    expect(next.drafts.has(0)).toBe(false);
  });

  test("step-back preserves in-progress free text and restores the target's", () => {
    const state: RequestState = {
      step: 1,
      drafts: new Map([[0, { selected: new Set(), freeText: "saved" }]]),
    };
    const { next, effects } = transitionRequests(state, requests, {
      type: "step-back",
      currentText: "typing on q2",
    });

    expect(next.step).toBe(0);
    expect(next.drafts.get(1)?.freeText).toBe("typing on q2");
    expect(effects[0]).toEqual({ type: "set-input-text", text: "saved" });
  });

  test("step navigation clamps at the ends", () => {
    const atStart = transitionRequests(INITIAL_REQUEST_STATE, requests, {
      type: "step-back",
      currentText: "",
    });
    expect(atStart.next).toBe(INITIAL_REQUEST_STATE);
    expect(atStart.effects).toEqual([]);
  });
});

describe("compileRequests", () => {
  test("skipped requests compile to empty-selection entries keyed by id", () => {
    expect(compileRequests(INITIAL_REQUEST_STATE, requests)).toEqual([
      { id: "q1", selected: [] },
      { id: "q2", selected: [] },
    ]);
  });

  test("free text on single-select compiles to a text entry", () => {
    const state: RequestState = {
      step: 0,
      drafts: new Map([[0, { selected: new Set(), freeText: " custom " }]]),
    };
    expect(compileRequests(state, requests)[0]).toEqual({ id: "q1", selected: [], text: "custom" });
  });

  test("text is omitted entirely when the user typed nothing", () => {
    const state: RequestState = {
      step: 0,
      drafts: new Map([[0, { selected: new Set(["A"]), freeText: "" }]]),
    };
    const entry = compileRequests(state, requests)[0];
    expect(entry).toBeDefined();
    expect(entry && "text" in entry).toBe(false);
  });

  test("option values are echoed when present, labels as fallback", () => {
    const valued: ComposerRequest[] = [
      {
        id: "framework",
        label: "Which framework?",
        options: [{ value: "next", label: "Next.js" }, { label: "Remix" }],
        multiSelect: true,
      },
    ];
    // Toggle keys are labels (how the widget wires Option value today).
    const state: RequestState = {
      step: 0,
      drafts: new Map([[0, { selected: new Set(["Next.js", "Remix"]), freeText: "" }]]),
    };
    expect(compileRequests(state, valued)[0]).toEqual({
      id: "framework",
      selected: ["next", "Remix"],
    });
  });

  test("a label colliding with another option's value resolves to the selected option", () => {
    const colliding: ComposerRequest[] = [
      {
        id: "pick",
        label: "Pick one",
        options: [
          { value: "c", label: "b" }, // this label equals the next option's value
          { value: "b", label: "Alpha" },
        ],
      },
    ];
    // The widget stores an option's identity (value ?? label) — here, "b" for
    // the second option. A cross-field lookup would match the first option's
    // label instead and wrongly emit "c".
    const state: RequestState = {
      step: 0,
      drafts: new Map([[0, { selected: new Set(["b"]), freeText: "" }]]),
    };
    expect(compileRequests(state, colliding)[0]).toEqual({ id: "pick", selected: ["b"] });
  });

  test("keys already stored as values resolve to the same values", () => {
    const valued: ComposerRequest[] = [
      { id: "db", label: "Database?", options: [{ value: "pg", label: "PostgreSQL" }] },
    ];
    const state: RequestState = {
      step: 0,
      drafts: new Map([[0, { selected: new Set(["pg"]), freeText: "" }]]),
    };
    expect(compileRequests(state, valued)[0]).toEqual({ id: "db", selected: ["pg"] });
  });
});

describe("isLastStep", () => {
  test("reports the final request", () => {
    expect(isLastStep({ step: 0, drafts: new Map() }, requests)).toBe(false);
    expect(isLastStep({ step: 1, drafts: new Map() }, requests)).toBe(true);
  });
});
