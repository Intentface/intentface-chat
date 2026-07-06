"use client";

import type { AskUserQuestion } from "@intentface/chat/composer";
import { useState } from "react";
import { Composer, type ComposerSubmitData } from "@/components/ai/composer";

// The questions prop routes the panel to an ask-user prompt. Answering (or
// skipping) the last question fires onSubmit with { kind: "answers" }. Passing
// a fresh questions array re-arms the flow from the first step.
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
      { label: "Analytics", description: "Usage and events." },
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

const previewButtonClass =
  "cursor-pointer rounded-full border border-primary-border bg-primary px-4 py-1.5 font-medium text-ink-secondary text-sm transition-colors hover:bg-primary-hover";

export const ComposerAskUserFlow = () => {
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
    // Reserve height and bottom-anchor so the ask-user panel opening (and the
    // reset button appearing) never shifts the surrounding layout.
    <div className="flex min-h-[440px] w-full max-w-xl flex-col items-center justify-end gap-3">
      <Composer questions={questions} onSubmit={handleSubmit}>
        <Composer.Panel value={done ? undefined : "ask-user"}>
          <Composer.PanelItem value="ask-user">
            <Composer.AskUser />
          </Composer.PanelItem>
        </Composer.Panel>
        <Composer.Container>
          <Composer.Textarea>
            <Composer.Placeholder
              placeholder={done ? "All set — reset to try again" : "Or type your own answer..."}
            />
          </Composer.Textarea>
          <Composer.Actions>
            {done ? (
              <Composer.Submit />
            ) : (
              <>
                <Composer.AskUserDismiss />
                <Composer.AskUserContinue />
              </>
            )}
          </Composer.Actions>
        </Composer.Container>
      </Composer>
      {done && (
        <button type="button" className={previewButtonClass} onClick={reset}>
          Reset questions
        </button>
      )}
    </div>
  );
};
