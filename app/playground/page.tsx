"use client";

import { CheckIcon, CircleDotIcon, Loader, XIcon } from "lucide-react";
import { useState } from "react";
import { Composer, useComposer } from "@/components/ai/composer";
import { StepQueue } from "@/components/ai/step-queue";
import { Steps } from "@/components/ai/steps";
import { BrainIcon } from "@/components/icons/brain";
import { GlobeIcon } from "@/components/icons/globe";
import { Questionnaire } from "@/components/questionnaire";
import { ThemeButton } from "@/components/theme-button";
import Button from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { AskUserQuestion } from "@/tools/ask-user";

// ---------------------------------------------------------------------------
// QuestionnaireDemo — local state wrapper for the Questionnaire primitive
// ---------------------------------------------------------------------------

const QuestionnaireDemo = ({
  questions,
  onSubmit,
}: {
  questions: AskUserQuestion[];
  onSubmit: (answers: Record<string, string>) => void;
}) => {
  const [step, setStep] = useState(0);
  const [selected, setSelected] = useState<Map<number, Set<string>>>(
    () => new Map(),
  );

  const current = questions[step];
  const isSingle = questions.length === 1;
  const currentSelected = selected.get(step) ?? new Set<string>();

  const toggle = (label: string) => {
    setSelected((prev) => {
      const next = new Map(prev);
      const set = new Set(prev.get(step) ?? []);
      if (current.multiSelect) {
        if (set.has(label)) set.delete(label);
        else set.add(label);
      } else {
        set.clear();
        set.add(label);
      }
      next.set(step, set);
      return next;
    });
  };

  const handleSubmit = () => {
    const result: Record<string, string> = {};
    for (let i = 0; i < questions.length; i++) {
      const sel = selected.get(i);
      result[questions[i].question] = sel ? [...sel].join(", ") : "";
    }
    onSubmit(result);
  };

  return (
    <Questionnaire>
      <Questionnaire.Header>
        <Questionnaire.Label>{current.question}</Questionnaire.Label>
        {!isSingle && (
          <Questionnaire.Navigation>
            <Questionnaire.Previous
              onClick={() => setStep((s) => Math.max(0, s - 1))}
              disabled={step === 0}
            />
            <Questionnaire.StepLabel
              current={step + 1}
              total={questions.length}
            />
            <Questionnaire.Next
              onClick={() =>
                setStep((s) => Math.min(questions.length - 1, s + 1))
              }
              disabled={step === questions.length - 1}
            />
          </Questionnaire.Navigation>
        )}
      </Questionnaire.Header>
      {current.options && (
        <Questionnaire.Options
          multiSelect={!!current.multiSelect}
          groupName={`demo-q-${step}`}
          value={[...currentSelected][0] ?? ""}
          onValueChange={(value) => toggle(value)}
        >
          {current.options.map((option) => (
            <Questionnaire.Option
              key={option.label}
              value={option.label}
              selected={currentSelected.has(option.label)}
              onSelect={() => toggle(option.label)}
            >
              <Questionnaire.OptionInput />
              <Questionnaire.OptionContent>
                <Questionnaire.OptionLabel>
                  {option.label}
                </Questionnaire.OptionLabel>
                {option.description && (
                  <Questionnaire.OptionDescription>
                    {option.description}
                  </Questionnaire.OptionDescription>
                )}
              </Questionnaire.OptionContent>
            </Questionnaire.Option>
          ))}
        </Questionnaire.Options>
      )}
      <div className="flex justify-end">
        <button
          type="button"
          onClick={handleSubmit}
          disabled={currentSelected.size === 0}
          className={cn(
            "rounded-md px-3 py-1 text-xs font-medium transition-colors",
            "bg-slate-12 text-slate-1 disabled:opacity-30",
          )}
        >
          Submit
        </button>
      </div>
    </Questionnaire>
  );
};

// ---------------------------------------------------------------------------
// ActiveTools — shows toggled tools as dismissable pills
// ---------------------------------------------------------------------------

const PlaygroundActiveTools = () => {
  const { tools } = useComposer();

  return (
    <div className="flex items-center gap-px">
      {tools.webSearch && (
        <Button
          type="button"
          variant="ghost"
          className="group/pill cursor-pointer rounded-full font-normal"
          onClick={() => tools.setWebSearch(false)}
        >
          <span className="relative size-4">
            <GlobeIcon className="opacity-100 absolute top-0 left-0 group-hover/pill:opacity-0" />
            <XIcon className="opacity-0 absolute top-0 left-0 group-hover/pill:opacity-100" />
          </span>
          Web Search
        </Button>
      )}
      {tools.thinking && (
        <Button
          type="button"
          variant="ghost"
          className="group/pill cursor-pointer rounded-full font-normal"
          onClick={() => tools.setThinking(false)}
        >
          <span className="relative size-4">
            <BrainIcon className="opacity-100 absolute top-0 left-0 group-hover/pill:opacity-0" />
            <XIcon className="opacity-0 absolute top-0 left-0 group-hover/pill:opacity-100" />
          </span>
          Thinking
        </Button>
      )}
    </div>
  );
};

// ---------------------------------------------------------------------------
// Composer States panel — needs useComposer() so must be inside <Composer>
// ---------------------------------------------------------------------------

const PlaygroundComposerStates = ({
  composerState,
  composerSteps,
}: {
  composerState: "idle" | "active" | "ask-user" | "ask-user-multi";
  composerSteps: string[];
}) => {
  const { mentions, commands } = useComposer();

  const deriveStatesValue = () => {
    if (mentions.open || commands.open) return "command-list";
    switch (composerState) {
      case "active":
        return "active";
      case "ask-user":
      case "ask-user-multi":
        return "ask-user";
      default:
        return "idle";
    }
  };
  const statesValue = deriveStatesValue();

  return (
    <Composer.States value={statesValue}>
      <Composer.State value="command-list">
        <Composer.CommandList />
      </Composer.State>
      <Composer.State value="active">
        <StepQueue>
          {composerSteps.map((step, i, arr) => (
            <StepQueue.Item key={`${step}-${i}`}>
              <StepQueue.Icon>
                {i === arr.length - 1 ? (
                  <Loader className="size-3.5 animate-spin" />
                ) : (
                  <CircleDotIcon className="size-3.5" />
                )}
              </StepQueue.Icon>
              <StepQueue.Label active={i === arr.length - 1}>
                {step}
              </StepQueue.Label>
            </StepQueue.Item>
          ))}
        </StepQueue>
      </Composer.State>
      <Composer.State value="ask-user">
        <Composer.Questionnaire />
      </Composer.State>
    </Composer.States>
  );
};

// ---------------------------------------------------------------------------
// Mock data — Steps
// ---------------------------------------------------------------------------

const stepLabels = [
  "Analyzing query",
  "Searching knowledge base",
  "Generating response",
  "Filtering results",
  "Ranking documents",
  "Extracting entities",
  "Summarizing findings",
  "Verifying sources",
  "Building context",
];

// ---------------------------------------------------------------------------
// Mock data — AskUser
// ---------------------------------------------------------------------------

const singleQuestion: AskUserQuestion[] = [
  {
    question: "Which database should we use?",
    header: "Database",
    options: [
      {
        label: "PostgreSQL",
        description: "Relational, battle-tested, great for structured data",
      },
      {
        label: "MongoDB",
        description:
          "Document store, flexible schema, good for rapid prototyping",
      },
      {
        label: "SQLite",
        description: "Embedded, zero-config, perfect for local development",
      },
    ],
  },
];

const multipleQuestions: AskUserQuestion[] = [
  {
    question: "Which auth method do you prefer?",
    header: "Auth",
    options: [
      {
        label: "OAuth 2.0",
        description: "Delegated auth via Google, GitHub, etc.",
      },
      {
        label: "JWT",
        description: "Stateless tokens, good for APIs",
      },
      {
        label: "Session-based",
        description: "Server-side sessions with cookies",
      },
      {
        label: "Passkeys",
        description: "WebAuthn-based passwordless authentication",
      },
    ],
  },
  {
    question: "Which features should we enable?",
    header: "Features",
    multiSelect: true,
    options: [
      {
        label: "Dark mode",
        description: "Theme toggle with system preference detection",
      },
      {
        label: "Notifications",
        description: "Push and in-app notification system",
      },
      {
        label: "Analytics",
        description: "Usage tracking and dashboard",
      },
      {
        label: "i18n",
        description: "Multi-language support with locale detection",
      },
    ],
  },
];

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function ComponentsPlayground() {
  const [items, setItems] = useState(stepLabels.slice(0, 2));

  // Composer state
  const [composerState, setComposerState] = useState<
    "idle" | "active" | "ask-user" | "ask-user-multi"
  >("idle");
  const [composerSteps, setComposerSteps] = useState(stepLabels.slice(0, 1));

  // AskUser state
  const [singleAnswers, setSingleAnswers] = useState<Record<
    string,
    string
  > | null>(null);
  const [multiAnswers, setMultiAnswers] = useState<Record<
    string,
    string
  > | null>(null);

  const addStep = () => {
    const next = stepLabels[items.length % stepLabels.length];
    setItems((prev) => [...prev, next]);
  };

  const reset = () => setItems(stepLabels.slice(0, 1));

  const resetAskUser = () => {
    setSingleAnswers(null);
    setMultiAnswers(null);
  };

  return (
    <main className="mx-auto max-w-3xl space-y-8 px-6 py-10">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-sm font-semibold text-slate-12">
          Component Playground
        </h1>
        <ThemeButton />
      </div>

      {/* Composer */}
      <div>
        <div className="mb-3 flex items-center justify-between">
          <p className="text-xs font-medium uppercase tracking-wider text-slate-10">
            Composer
          </p>
          <div className="flex items-center gap-2">
            {(["idle", "active", "ask-user", "ask-user-multi"] as const).map(
              (state) => (
                <button
                  key={state}
                  type="button"
                  onClick={() => {
                    if (state === "active") {
                      if (composerState === "active") {
                        const next =
                          stepLabels[composerSteps.length % stepLabels.length];
                        setComposerSteps((prev) => [...prev, next]);
                        return;
                      }
                      setComposerSteps(stepLabels.slice(0, 1));
                    }
                    setComposerState(state);
                  }}
                  className={cn(
                    "rounded-md px-3 py-1 text-xs font-medium transition-colors",
                    composerState === state
                      ? "bg-slate-12 text-slate-1"
                      : "border border-slate-7 text-slate-11 hover:bg-slate-3",
                  )}
                >
                  {state === "idle"
                    ? "Idle"
                    : state === "active"
                      ? "Active"
                      : state === "ask-user"
                        ? "Ask User"
                        : "Ask Multi"}
                </button>
              ),
            )}
          </div>
        </div>
        <div className="flex min-h-[448px] items-end rounded-lg border border-slate-7 bg-slate-2 p-4">
          <Composer
            onSubmit={() => {}}
            questions={
              composerState === "ask-user"
                ? singleQuestion
                : composerState === "ask-user-multi"
                  ? multipleQuestions
                  : undefined
            }
            onQuestionsSubmit={() => setComposerState("idle")}
          >
            <PlaygroundComposerStates
              composerState={composerState}
              composerSteps={composerSteps}
            />

            <Composer.Container>
              <Composer.Attachments />
              <Composer.Textarea>
                <Composer.Placeholder
                  placeholder={
                    composerState === "ask-user" ||
                    composerState === "ask-user-multi"
                      ? "Or type your own answer..."
                      : [
                          "Ask me anything...",
                          "Search the web...",
                          "Generate a report...",
                        ]
                  }
                />
              </Composer.Textarea>
              {composerState === "ask-user" ||
              composerState === "ask-user-multi" ? (
                <Composer.Actions>
                  <Composer.DismissAction />
                  <Composer.ContinueAction />
                </Composer.Actions>
              ) : (
                <Composer.Actions className="justify-between">
                  <div className="flex items-center">
                    <Composer.AttachmentTrigger />
                    <PlaygroundActiveTools />
                  </div>
                  <Composer.Submit />
                </Composer.Actions>
              )}
            </Composer.Container>
          </Composer>
        </div>
      </div>

      {/* StepQueue */}
      <div>
        <div className="mb-3 flex items-center justify-between">
          <p className="text-xs font-medium uppercase tracking-wider text-slate-10">
            StepQueue
          </p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={addStep}
              className="rounded-md bg-slate-12 px-3 py-1 text-xs font-medium text-slate-1 transition-colors hover:bg-slate-11"
            >
              Add Step
            </button>
            <button
              type="button"
              onClick={reset}
              className="rounded-md border border-slate-7 px-3 py-1 text-xs font-medium text-slate-11 transition-colors hover:bg-slate-3"
            >
              Reset
            </button>
          </div>
        </div>
        <div className="rounded-lg border border-slate-6 bg-slate-2 p-4">
          <div className="rounded-2xl border border-slate-6 bg-slate-1">
            <StepQueue>
              {items.map((label, i) => {
                const active = i === items.length - 1;
                return (
                  <StepQueue.Item key={`${label}-${i}`}>
                    <StepQueue.Icon>
                      {active ? (
                        <Loader className="size-3.5 animate-spin" />
                      ) : (
                        <CheckIcon className="size-3.5" />
                      )}
                    </StepQueue.Icon>
                    <StepQueue.Label active={active}>{label}</StepQueue.Label>
                  </StepQueue.Item>
                );
              })}
            </StepQueue>
          </div>
        </div>
      </div>

      {/* Steps */}
      <div>
        <p className="mb-3 text-xs font-medium uppercase tracking-wider text-slate-10">
          Steps
        </p>
        <div className="rounded-lg border border-slate-6 bg-slate-2 p-4">
          <Steps defaultOpen>
            <Steps.Header>Researched 4 sources</Steps.Header>
            <Steps.Content>
              <Steps.Step label="Searched the web" status="complete">
                <Steps.SearchResults>
                  <Steps.SearchResult>reddit.com</Steps.SearchResult>
                  <Steps.SearchResult>stackoverflow.com</Steps.SearchResult>
                  <Steps.SearchResult>github.com</Steps.SearchResult>
                </Steps.SearchResults>
              </Steps.Step>

              <Steps.Step label="Read 3 articles" status="complete">
                <Steps.Body>
                  Found relevant documentation about compound component patterns
                  and animation best practices with Framer Motion.
                </Steps.Body>
              </Steps.Step>

              <Steps.Step label="Analyzing results" status="active" />

              <Steps.Step label="Generating answer" status="pending" />
            </Steps.Content>
          </Steps>
        </div>
      </div>

      {/* Questionnaire */}
      <div>
        <div className="mb-3 flex items-center justify-between">
          <p className="text-xs font-medium uppercase tracking-wider text-slate-10">
            Questionnaire
          </p>
          <button
            type="button"
            onClick={resetAskUser}
            className="rounded-md border border-slate-7 px-3 py-1 text-xs font-medium text-slate-11 transition-colors hover:bg-slate-3"
          >
            Reset
          </button>
        </div>

        <div className="space-y-4">
          {/* Single question */}
          <div>
            <p className="mb-2 text-xs text-slate-10">Single question</p>
            <div className="rounded-lg border border-slate-6 bg-slate-2 p-4">
              <div className="rounded-2xl border border-slate-6 bg-slate-1">
                <QuestionnaireDemo
                  questions={singleQuestion}
                  onSubmit={(answers) => {
                    console.log("Single question answers:", answers);
                    setSingleAnswers(answers);
                  }}
                />
              </div>
              {singleAnswers && (
                <pre className="mt-3 rounded-md bg-slate-3 p-3 text-xs text-slate-11">
                  {JSON.stringify(singleAnswers, null, 2)}
                </pre>
              )}
            </div>
          </div>

          {/* Multiple questions */}
          <div>
            <p className="mb-2 text-xs text-slate-10">
              Multiple questions (stepper)
            </p>
            <div className="rounded-lg border border-slate-6 bg-slate-2 p-4">
              <div className="rounded-2xl border border-slate-6 bg-slate-1">
                <QuestionnaireDemo
                  questions={multipleQuestions}
                  onSubmit={(answers) => {
                    console.log("Multi question answers:", answers);
                    setMultiAnswers(answers);
                  }}
                />
              </div>
              {multiAnswers && (
                <pre className="mt-3 rounded-md bg-slate-3 p-3 text-xs text-slate-11">
                  {JSON.stringify(multiAnswers, null, 2)}
                </pre>
              )}
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
