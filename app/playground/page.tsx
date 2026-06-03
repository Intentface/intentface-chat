"use client";

import { CircleDotIcon, Loader, TextQuoteIcon, XIcon } from "lucide-react";
import { useCallback, useMemo, useState } from "react";
import { type CommandItemData, Composer } from "@/components/ai/composer";
import { StepQueue } from "@/components/ai/step-queue";
import { ActiveTools, ToolsMenu } from "@/components/composer-tools";
import { ModelSelector } from "@/components/model-selector";
import { ThemeButton } from "@/components/theme-button";
import { useModelStore } from "@/lib/store/model";
import { cn } from "@/lib/utils";
import type { AskUserQuestion } from "@/tools/ask-user";

// ---------------------------------------------------------------------------
// Composer States panel — needs useComposer() so must be inside <Composer>
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
        description: "Document store, flexible schema, good for rapid prototyping",
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

const PLAYGROUND_MENTIONS: CommandItemData[] = [
  { value: "demo-doc", label: "Demo Document", icon: "fileText" },
  { value: "release-notes", label: "Release Notes", icon: "fileText" },
];

// Async-callback exercise: a fake "issues" list fetched with simulated latency.
// Typing `#` opens the list; typing fast aborts in-flight calls via AbortSignal.
const PLAYGROUND_ISSUES: CommandItemData[] = [
  { value: "i-123", label: "#123 Login throws on empty password" },
  { value: "i-142", label: "#142 Memory leak in idle workers" },
  { value: "i-199", label: "#199 Search returns stale results" },
  { value: "i-231", label: "#231 Markdown render flash" },
  { value: "i-287", label: "#287 Composer keyboard nav broken on Safari" },
  { value: "i-312", label: "#312 Theme picker overflow" },
  { value: "i-356", label: "#356 Streaming cancellation race" },
  { value: "i-401", label: "#401 Empty state CTA too small" },
  { value: "i-445", label: "#445 Sidebar collapse animation jank" },
  { value: "i-478", label: "#478 i18n stubs out of date" },
  { value: "i-502", label: "#502 Attachment thumbnails missing" },
  { value: "i-534", label: "#534 Auth token refresh loop" },
].map((item) => ({ ...item, icon: "code" as const }));

const abortableDelay = (ms: number, signal: AbortSignal) =>
  new Promise<void>((resolve, reject) => {
    if (signal.aborted) {
      reject(new DOMException("Aborted", "AbortError"));
      return;
    }
    const id = setTimeout(resolve, ms);
    signal.addEventListener("abort", () => {
      clearTimeout(id);
      reject(new DOMException("Aborted", "AbortError"));
    });
  });

const fetchPlaygroundIssues = async (
  query: string,
  { signal }: { signal: AbortSignal },
): Promise<CommandItemData[]> => {
  const latency = 300 + Math.random() * 600;
  await abortableDelay(latency, signal);
  const lowered = query.toLowerCase();
  if (!lowered) return PLAYGROUND_ISSUES;
  return PLAYGROUND_ISSUES.filter((item) => item.label.toLowerCase().includes(lowered));
};

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function ComponentsPlayground() {
  const [composerState, setComposerState] = useState<
    "idle" | "active" | "ask-user" | "ask-user-multi"
  >("idle");
  const [composerSteps, setComposerSteps] = useState(stepLabels.slice(0, 1));
  // Independent of the panel states — the context window can be visible at
  // the same time as any panel.
  const [showContextWindow, setShowContextWindow] = useState(false);
  const { model, setModel } = useModelStore();

  const [toolValues, setToolValues] = useState<Record<string, boolean>>({});
  const setTool = useCallback((name: string, value: boolean) => {
    setToolValues((previous) => ({ ...previous, [name]: value }));
  }, []);

  const playgroundCommands = useMemo<CommandItemData[]>(
    () => [
      {
        value: "webSearch",
        label: "Search the web",
        icon: "globe",
        keywords: "search web",
        onSelect: () => setTool("webSearch", true),
      },
      {
        value: "thinking",
        label: "Think deeply",
        icon: "brain",
        keywords: "think reasoning",
        onSelect: () => setTool("thinking", true),
      },
    ],
    [setTool],
  );

  const panelValue =
    composerState === "active"
      ? "active"
      : composerState === "ask-user" || composerState === "ask-user-multi"
        ? "ask-user"
        : "idle";

  const questions =
    composerState === "ask-user"
      ? singleQuestion
      : composerState === "ask-user-multi"
        ? multipleQuestions
        : undefined;

  return (
    <main className="mx-auto max-w-3xl space-y-8 px-6 py-10">
      <div className="flex items-center justify-between">
        <h1 className="text-sm font-semibold text-ink-primary">Component Playground</h1>
        <ThemeButton />
      </div>

      <div>
        <div className="mb-3 flex items-center justify-between">
          <p className="text-xs font-medium uppercase tracking-wider text-ink-tertiary">Composer</p>
          <div className="flex items-center gap-2">
            {(["idle", "active", "ask-user", "ask-user-multi"] as const).map((state) => (
              <button
                key={state}
                type="button"
                onClick={() => {
                  if (state === "active") {
                    if (composerState === "active") {
                      const next = stepLabels[composerSteps.length % stepLabels.length];
                      setComposerSteps((prev) => [...prev, next]);
                      return;
                    }
                    setComposerSteps(stepLabels.slice(0, 1));
                  }
                  setComposerState(state);
                }}
                className={cn(
                  "rounded-md px-3 py-1 text-xs border border-primary-border bg-primary text-ink-secondary hover:bg-primary-hover font-medium transition-colors",
                  composerState === state && "bg-primary-active text-slate-1",
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
            ))}
            <div className="h-4 w-px bg-primary-border" />
            <button
              type="button"
              onClick={() => setShowContextWindow((previous) => !previous)}
              className={cn(
                "rounded-md px-3 py-1 text-xs border border-primary-border bg-primary text-ink-secondary hover:bg-primary-hover font-medium transition-colors",
                showContextWindow && "bg-primary-active text-slate-1",
              )}
            >
              Context
            </button>
          </div>
        </div>
        <div className="flex min-h-[448px] items-end rounded-lg border border-secondary-border bg-secondary p-4">
          <Composer
            onSubmit={(data) => {
              if (data.kind === "answers") setComposerState("idle");
            }}
            commands={{
              "@": {
                kind: "insert",
                trigger: "after-whitespace",
                items: PLAYGROUND_MENTIONS,
              },
              "/": {
                kind: "execute",
                trigger: "doc-start",
                items: playgroundCommands,
              },
              "#": {
                kind: "insert",
                trigger: "after-whitespace",
                items: fetchPlaygroundIssues,
              },
            }}
            questions={questions}
          >
            <Composer.Panel value={panelValue}>
              <Composer.PanelItem value="command-list">
                <Composer.Commands />
              </Composer.PanelItem>
              <Composer.PanelItem value="active">
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
                      <StepQueue.Label active={i === arr.length - 1}>{step}</StepQueue.Label>
                    </StepQueue.Item>
                  ))}
                </StepQueue>
              </Composer.PanelItem>
              <Composer.PanelItem value="ask-user">
                <Composer.AskUser />
              </Composer.PanelItem>
            </Composer.Panel>

            <Composer.ContextWindow>
              {showContextWindow && (
                <div className="flex items-center gap-1.5 text-ink-secondary">
                  <TextQuoteIcon className="size-3.5" />
                  <span>2 selections</span>
                  <button
                    type="button"
                    aria-label="Clear selections"
                    className="cursor-pointer rounded-full p-0.5 hover:bg-primary-hover hover:text-ink-primary"
                    onClick={() => setShowContextWindow(false)}
                  >
                    <XIcon className="size-3" />
                  </button>
                </div>
              )}
            </Composer.ContextWindow>
            <Composer.Container>
              <Composer.Attachments />
              <Composer.Textarea>
                <Composer.Placeholder
                  placeholder={
                    composerState === "ask-user" || composerState === "ask-user-multi"
                      ? "Or type your own answer..."
                      : ["Ask me anything...", "Search the web...", "Generate a report..."]
                  }
                />
              </Composer.Textarea>
              {composerState === "ask-user" || composerState === "ask-user-multi" ? (
                <Composer.Actions className="flex items-center justify-end">
                  <Composer.AskUserHints />
                  <Composer.AskUserDismiss />
                  <Composer.AskUserContinue />
                </Composer.Actions>
              ) : (
                <Composer.Actions className="flex items-center justify-between">
                  <div className="flex items-center">
                    <ToolsMenu tools={toolValues} onToolsChange={setToolValues} />
                    <ModelSelector value={model} onValueChange={setModel} />
                    <ActiveTools tools={toolValues} onToolsChange={setToolValues} />
                  </div>
                  <Composer.Submit />
                </Composer.Actions>
              )}
            </Composer.Container>
          </Composer>
        </div>
      </div>
    </main>
  );
}
