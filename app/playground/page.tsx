"use client";

import { CheckIcon, CircleDotIcon, Loader } from "lucide-react";
import { useState } from "react";
import { Composer } from "@/components/ai/composer";
import { StepQueue } from "@/components/ai/step-queue";
import { Steps } from "@/components/ai/steps";
import { Questionnaire } from "@/components/questionnaire";
import { ThemeButton } from "@/components/theme-button";
import { cn } from "@/lib/utils";
import type { AskUserQuestion } from "@/tools/ask-user";

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
        <div className="flex min-h-[448px] items-end rounded-lg border border-slate-6 bg-slate-2 p-4">
          <Composer
            onSubmit={() => {}}
            questions={
              composerState === "ask-user"
                ? singleQuestion
                : composerState === "ask-user-multi"
                  ? multipleQuestions
                  : undefined
            }
            onQuestionsDone={() => setComposerState("idle")}
          >
            <Composer.States>
              {composerState === "active" && (
                <Composer.State key="steps">
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
              )}
              {(composerState === "ask-user" ||
                composerState === "ask-user-multi") && (
                <Composer.State key="ask-user">
                  <Composer.Questionnaire />
                </Composer.State>
              )}
            </Composer.States>

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
              <Composer.Actions>
                {composerState === "ask-user" ||
                composerState === "ask-user-multi" ? (
                  <div className="flex items-center justify-end gap-2">
                    <Composer.DismissAction />
                    <Composer.ContinueAction />
                  </div>
                ) : (
                  <div className="flex items-center justify-between gap-2">
                    <Composer.AttachmentTrigger />
                    <Composer.Submit />
                  </div>
                )}
              </Composer.Actions>
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
                <Questionnaire
                  onSubmit={(answers) => {
                    console.log("Single question answers:", answers);
                    setSingleAnswers(answers);
                  }}
                >
                  <Questionnaire.Content>
                    {singleQuestion.map((q) => (
                      <Questionnaire.Step
                        key={q.question}
                        value={q.question}
                        multiSelect={q.multiSelect}
                      >
                        <Questionnaire.Label>{q.question}</Questionnaire.Label>
                        <Questionnaire.Options>
                          {q.options?.map((option) => (
                            <Questionnaire.Option
                              key={option.label}
                              value={option.label}
                              description={option.description}
                            />
                          ))}
                        </Questionnaire.Options>
                        <Questionnaire.TextInput
                          hasOptions={!!q.options?.length}
                        />
                      </Questionnaire.Step>
                    ))}
                  </Questionnaire.Content>
                  <Questionnaire.Actions />
                </Questionnaire>
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
                <Questionnaire
                  onSubmit={(answers) => {
                    console.log("Multi question answers:", answers);
                    setMultiAnswers(answers);
                  }}
                >
                  <div className="flex items-center gap-1 self-end shrink-0">
                    <Questionnaire.Previous />
                    <Questionnaire.StepLabel />
                    <Questionnaire.Next />
                  </div>
                  <Questionnaire.Content>
                    {multipleQuestions.map((q) => (
                      <Questionnaire.Step
                        key={q.question}
                        value={q.question}
                        multiSelect={q.multiSelect}
                      >
                        <Questionnaire.Label>{q.question}</Questionnaire.Label>
                        <Questionnaire.Options>
                          {q.options?.map((option) => (
                            <Questionnaire.Option
                              key={option.label}
                              value={option.label}
                              description={option.description}
                            />
                          ))}
                        </Questionnaire.Options>
                        <Questionnaire.TextInput
                          hasOptions={!!q.options?.length}
                        />
                      </Questionnaire.Step>
                    ))}
                    <Questionnaire.Review />
                  </Questionnaire.Content>
                  <Questionnaire.Actions />
                </Questionnaire>
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
