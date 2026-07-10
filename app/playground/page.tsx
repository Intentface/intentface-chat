"use client";

import { FileCodeIcon, FileSpreadsheetIcon, FileTextIcon } from "lucide-react";
import { useCallback, useMemo, useState } from "react";
import { type CommandItemData, Composer } from "@/components/ai/composer";
import { ActiveTools, ToolsMenu } from "@/components/composer-tools";
import { ArrowsAllSides2Icon } from "@/components/icons/arrows-all-sides-2";
import { ModelSelector } from "@/components/model-selector";
import { ThemeButton } from "@/components/theme-button";
import { IconButton } from "@/components/ui/icon-button";
import type { AskUserQuestion } from "@/lib/ai/types";
import { useModelStore } from "@/lib/store/model";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Composer States panel — needs useComposer() so must be inside <Composer>
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
// The package has no `group` field, so we attach our own for the grouping demo.
type GroupedIssue = CommandItemData & { group: string };

// Sorted by group (Bugs → UI → Performance) on purpose: the command list's
// highlight is a flat index over this order, so keeping the source grouped keeps
// arrow-key nav aligned with the visual groups below. Reorder it and the
// highlight would jump between groups as you press down.
// Linear-style identifiers: the label describes the entity without repeating
// the typed trigger, so the committed chip reads "INT-123 …", not "##123 …".
const PLAYGROUND_ISSUES: GroupedIssue[] = [
  { value: "INT-123", label: "INT-123 Login throws on empty password", group: "Bugs" },
  { value: "INT-199", label: "INT-199 Search returns stale results", group: "Bugs" },
  { value: "INT-287", label: "INT-287 Composer keyboard nav broken on Safari", group: "Bugs" },
  { value: "INT-478", label: "INT-478 i18n stubs out of date", group: "Bugs" },
  { value: "INT-534", label: "INT-534 Auth token refresh loop", group: "Bugs" },
  { value: "INT-231", label: "INT-231 Markdown render flash", group: "UI" },
  { value: "INT-312", label: "INT-312 Theme picker overflow", group: "UI" },
  { value: "INT-401", label: "INT-401 Empty state CTA too small", group: "UI" },
  { value: "INT-445", label: "INT-445 Sidebar collapse animation jank", group: "UI" },
  { value: "INT-502", label: "INT-502 Attachment thumbnails missing", group: "UI" },
  { value: "INT-142", label: "INT-142 Memory leak in idle workers", group: "Performance" },
  { value: "INT-356", label: "INT-356 Streaming cancellation race", group: "Performance" },
].map((item) => ({ ...item, icon: "bug" as const }));

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
): Promise<GroupedIssue[]> => {
  const latency = 300 + Math.random() * 600;
  await abortableDelay(latency, signal);
  const lowered = query.toLowerCase();
  if (!lowered) return PLAYGROUND_ISSUES;
  return PLAYGROUND_ISSUES.filter((item) => item.label.toLowerCase().includes(lowered));
};

// ---------------------------------------------------------------------------
// Grouped command list — Composer.CommandGroup owns the partition: give it a
// `groupBy` (our own `group` field) and it buckets the resolved, library-filtered
// items in first-appearance order (so nav still flows top-to-bottom), rendering the
// callback once per group. A group whose items all filter out just doesn't render.
// ---------------------------------------------------------------------------

const GroupedIssueList = () => (
  <Composer.CommandGroup groupBy={(item: GroupedIssue) => item.group}>
    {(group, items) => (
      <>
        <Composer.CommandGroupLabel>{group}</Composer.CommandGroupLabel>
        {items.map((item) => (
          <Composer.CommandItem key={item.value} value={item.value}>
            <Composer.CommandItemLabel>{item.label}</Composer.CommandItemLabel>
          </Composer.CommandItem>
        ))}
      </>
    )}
  </Composer.CommandGroup>
);

const GroupedIssueCommands = () => (
  <Composer.Command prefix="#">
    <Composer.CommandLoading />
    <Composer.CommandEmpty />
    <GroupedIssueList />
  </Composer.Command>
);

// Demo: files "open in the workspace" surfaced as the AI's context, shown in the
// strip peeking above the composer and toggled by the scan button in the chrome.
const DEMO_CONTEXT_FILES = [
  { id: "prd", name: "PRD.md", icon: FileTextIcon },
  { id: "auth", name: "auth-service.ts", icon: FileCodeIcon },
  { id: "metrics", name: "metrics.xlsx", icon: FileSpreadsheetIcon },
];

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function ComponentsPlayground() {
  const [composerState, setComposerState] = useState<
    "idle" | "active" | "ask-user" | "ask-user-multi"
  >("idle");
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
        <p className="mb-3 text-xs font-medium uppercase tracking-wider text-ink-tertiary">
          Composer
        </p>
        <div className="flex min-h-[640px] items-end justify-center rounded-lg border border-secondary-border bg-secondary p-4">
          <div className="flex w-full max-w-xl flex-col items-center">
            <div className="relative w-full">
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
                <Composer.Panel>
                  {(composer) => {
                    if (composer.commands.active) {
                      return ["@", "/", "#"].map((prefix) =>
                        prefix === "#" ? (
                          <GroupedIssueCommands key={prefix} />
                        ) : (
                          <Composer.Commands key={prefix} prefix={prefix} />
                        ),
                      );
                    }
                    if (questions != null) return <Composer.AskUser />;
                    return null;
                  }}
                </Composer.Panel>

                <Composer.ContextWindow>
                  {showContextWindow && (
                    <div data-slot="context-files" className="flex items-center gap-1.5">
                      {DEMO_CONTEXT_FILES.map((file) => (
                        <span
                          key={file.id}
                          className="inline-flex items-center gap-1 rounded-md bg-primary-hover px-1.5 py-0.5 text-ink-secondary"
                        >
                          <file.icon className="size-3.5 text-ink-tertiary" />
                          {file.name}
                        </span>
                      ))}
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
                    <Composer.Actions className="flex items-center justify-end gap-2">
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
                      <div className="flex items-center gap-1">
                        <IconButton
                          type="button"
                          variant="ghost"
                          size="sm"
                          aria-pressed={showContextWindow}
                          aria-label="Toggle workspace context"
                          onClick={() => setShowContextWindow((previous) => !previous)}
                          className={cn(showContextWindow && "bg-primary-hover text-ink-primary")}
                        >
                          <ArrowsAllSides2Icon />
                        </IconButton>
                        <Composer.Submit />
                      </div>
                    </Composer.Actions>
                  )}
                </Composer.Container>
              </Composer>
            </div>
            <div className="mt-4 flex items-center gap-2">
              {(["idle", "ask-user", "ask-user-multi"] as const).map((state) => (
                <button
                  key={state}
                  type="button"
                  onClick={() => {
                    setComposerState(state);
                  }}
                  className={cn(
                    "rounded-full border border-primary-border bg-primary px-4 py-1.5 text-sm text-ink-secondary font-medium transition-colors hover:bg-primary-hover",
                    composerState === state && "bg-primary-active text-slate-1",
                  )}
                >
                  {state === "idle" ? "Idle" : state === "ask-user" ? "Ask User" : "Ask Multi"}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
