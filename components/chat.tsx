"use client";

import type { UseChatHelpers } from "@ai-sdk/react";
import {
  getFileParts,
  getSegmentedParts,
  getTextInfo,
  groupTurns,
  type MessageSegment,
} from "@intentface/chat/message-utils";
import { isToolPart, type ToolPart, type UnknownPart } from "@intentface/chat/types";
import type { ChatStatus } from "ai";
import { CircleIcon } from "lucide-react";
import { AnimatePresence, motion, stagger } from "motion/react";
import { useRouter } from "next/navigation";
import {
  Children,
  createContext,
  memo,
  use,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { type CommandItemData, Composer, type ComposerSubmitData } from "@/components/ai/composer";
import { Message } from "@/components/ai/message";
import { Reasoning } from "@/components/ai/reasoning";
import { Steps } from "@/components/ai/steps";
import { Thread } from "@/components/ai/thread";
import { ActiveTools, ToolsMenu } from "@/components/composer-tools";
import { Header } from "@/components/header";
import { BrainIcon } from "@/components/icons/brain";
import { CheckMarkMediumIcon } from "@/components/icons/check-mark-medium";
import { ChevronDownIcon } from "@/components/icons/chevron-down";
import { CircleQuestionmarkIcon } from "@/components/icons/circle-questionmark";
import { CrossMediumIcon } from "@/components/icons/cross-medium";
import { ExclamationTriangleIcon } from "@/components/icons/exclamation-triangle";
import { OpenQuote2Icon } from "@/components/icons/open-quote-2";
import { RefreshIcon } from "@/components/icons/refresh";
import { ModelSelector } from "@/components/model-selector";
import { Markdown } from "@/components/ui/markdown";
import { useChatInstance } from "@/hooks/use-chat-instance";
import { useThrottledText } from "@/hooks/use-throttled-text";
import { prepareAttachmentsForSend } from "@/lib/ai/attachments";
import {
  getChainInfo,
  getReasoningInfo,
  getSourcesInfo,
  splitReasoningByHeaders,
} from "@/lib/ai/message-info";
import { getAskUserInfo, getAskUserStepInfo, getToolCallInfo } from "@/lib/ai/steps-info";
import { DEFAULT_TOOL_LABELS } from "@/lib/ai/tool-labels";
import type { AppUIMessage, AskUserInput, AskUserQuestion, StepStatus } from "@/lib/ai/types";
import { applyStopToMessages } from "@/lib/chat-instance";
import { useChatStore } from "@/lib/store/chat";
import { useModelStore } from "@/lib/store/model";
import { useSettingsStore } from "@/lib/store/settings";
import { cn } from "@/lib/utils";
import { IntentfaceLogo } from "./icons/intentface-logo";
import { TextShimmer } from "./ui/text-shimmer";

type ChatSelection = {
  id: string;
  text: string;
};

// Split contexts: the session value changes rarely (selection edits, the
// isEmpty flip) while the messages value changes on every stream chunk.
// Keeping them apart means the composer and layout chrome never re-render per
// token — only ChatMessages and the thin composer bridge subscribe to the
// volatile side.
type ChatSessionValue = {
  chatId: string;
  /** True until the first message exists — flips once per chat. */
  isEmpty: boolean;
  sendMessage: UseChatHelpers<AppUIMessage>["sendMessage"];
  regenerate: UseChatHelpers<AppUIMessage>["regenerate"];
  stop: UseChatHelpers<AppUIMessage>["stop"];
  setMessages: UseChatHelpers<AppUIMessage>["setMessages"];
  addToolOutput: UseChatHelpers<AppUIMessage>["addToolOutput"];
  selections: ChatSelection[];
  addSelection: (text: string) => void;
  clearSelections: () => void;
};

type ChatMessagesValue = {
  messages: AppUIMessage[];
  status: ChatStatus;
};

const ChatSessionContext = createContext<ChatSessionValue | null>(null);
const ChatMessagesContext = createContext<ChatMessagesValue | null>(null);

export const useChatSession = (): ChatSessionValue => {
  const ctx = use(ChatSessionContext);
  if (!ctx) {
    throw new Error("useChatSession must be used within a <Chat> provider");
  }
  return ctx;
};

export const useChatMessages = (): ChatMessagesValue => {
  const ctx = use(ChatMessagesContext);
  if (!ctx) {
    throw new Error("useChatMessages must be used within a <Chat> provider");
  }
  return ctx;
};

// ---------------------------------------------------------------------------
// InterleavedSteps — renders reasoning + tools chronologically
// ---------------------------------------------------------------------------

type IconComponent = React.ComponentType<{ className?: string }>;

const statusIcons: Record<StepStatus, IconComponent> = {
  complete: CheckMarkMediumIcon,
  active: CircleIcon,
  pending: CircleIcon,
  error: ExclamationTriangleIcon,
};

// A timeline row: static when it has no detail, collapsible (icon morphs to a
// chevron) when it does. App-owned — composed over the Steps primitive.
const TimelineStep = ({
  label,
  status = "complete",
  icon,
  children,
}: {
  label: string;
  status?: StepStatus;
  icon?: IconComponent;
  children?: React.ReactNode;
}) => {
  const Icon = icon ?? statusIcons[status];
  const hasDetail = Children.toArray(children).length > 0;

  const iconClasses = cn(
    status === "complete" && "text-ink-secondary",
    status === "active" && "text-ink-primary",
    status === "pending" && "text-slate-9",
    status === "error" && "text-red-500",
  );
  const labelClasses = cn(
    "text-sm text-left",
    status === "active" && "text-ink-primary font-medium",
    status === "complete" && "text-ink-secondary",
    status === "pending" && "text-slate-9",
    status === "error" && "text-red-500",
  );

  if (!hasDetail) {
    return (
      <Steps.Item status={status}>
        <div className="flex items-center gap-2 py-0.5">
          <span className={cn("flex size-4 shrink-0 items-center justify-center", iconClasses)}>
            <Icon className={cn("size-3.5", status === "active" && "animate-pulse")} />
          </span>
          <span className={labelClasses}>{label}</span>
        </div>
      </Steps.Item>
    );
  }

  return (
    <Steps.Item status={status}>
      <Steps.Trigger>
        <span
          className={cn("relative flex size-4 shrink-0 items-center justify-center", iconClasses)}
        >
          <span className="transition-opacity group-hover/steps-trigger:opacity-0 group-data-open/steps-trigger:opacity-0">
            <Icon className={cn("size-3.5", status === "active" && "animate-pulse")} />
          </span>
          <ChevronDownIcon className="absolute size-4 opacity-0 transition-all group-hover/steps-trigger:opacity-100 group-data-open/steps-trigger:rotate-180 group-data-open/steps-trigger:opacity-100" />
        </span>
        <span className={labelClasses}>{label}</span>
      </Steps.Trigger>
      <Steps.Panel>{children}</Steps.Panel>
    </Steps.Item>
  );
};

const TimelineToolCall = ({ part }: { part: ToolPart }) => {
  const { label, status, summary, errorText, sources } = getToolCallInfo(part, DEFAULT_TOOL_LABELS);

  return (
    <TimelineStep label={label} status={status}>
      {errorText && <span className="text-xs text-red-500">{errorText}</span>}
      {summary && <span className="text-xs text-ink-secondary">{summary}</span>}
      {sources.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {sources.map((source, index) => (
            <span
              key={index}
              className="inline-flex items-center rounded-md border border-primary-border bg-primary px-2 py-0.5 text-xs text-ink-secondary"
            >
              {source.domain}
            </span>
          ))}
        </div>
      )}
    </TimelineStep>
  );
};

const TimelineAskUser = ({ part }: { part: ToolPart }) => {
  const { label, status, questions, answers, isComplete } = getAskUserStepInfo(part);

  return (
    <TimelineStep label={label} status={status} icon={CircleQuestionmarkIcon}>
      <div className="flex flex-col gap-1.5">
        {questions.map((q) => (
          <div key={q.question} className="flex flex-col gap-0.5">
            <span className="text-xs font-medium leading-tight text-ink-primary">{q.question}</span>
            {isComplete && (
              <span className="text-xs leading-tight text-ink-secondary">
                {answers[q.question] ?? "—"}
              </span>
            )}
          </div>
        ))}
      </div>
    </TimelineStep>
  );
};

const InterleavedSteps = ({
  segments,
  isStreaming,
  awaitingInput = false,
}: {
  segments: MessageSegment[];
  isStreaming: boolean;
  // An open ask-user prompt means the turn is paused, not finished — keep the block
  // in its active state (cycling header, open) rather than the "done" summary.
  awaitingInput?: boolean;
}) => {
  const isActive = isStreaming || awaitingInput;
  const { toolCount, questionCount } = segments.reduce(
    (acc, s) => {
      if (s.type !== "tool") return acc;
      for (const p of s.parts) {
        if (p.type === "tool-askUser") {
          const input = p.input as { questions?: unknown[] } | undefined;
          acc.questionCount += input?.questions?.length ?? 0;
        } else {
          acc.toolCount++;
        }
      }
      return acc;
    },
    { toolCount: 0, questionCount: 0 },
  );

  // Track duration like Reasoning does
  const [duration, setDuration] = useState<number | undefined>(undefined);
  const startTimeRef = useRef<number | null>(null);

  useEffect(() => {
    if (isStreaming) {
      if (startTimeRef.current === null) {
        startTimeRef.current = Date.now();
      }
    } else if (startTimeRef.current !== null) {
      setDuration(Math.ceil((Date.now() - startTimeRef.current) / 1000));
      startTimeRef.current = null;
    }
  }, [isStreaming]);

  const suffixes: string[] = [];
  if (toolCount > 0) suffixes.push(`used ${toolCount} tool${toolCount !== 1 ? "s" : ""}`);
  if (questionCount > 0)
    suffixes.push(`asked ${questionCount} question${questionCount !== 1 ? "s" : ""}`);
  const suffix = suffixes.length > 0 ? `, ${suffixes.join(", ")}` : "";

  // While streaming the header cycles to the running tool's label — falling back to the
  // last tool between rounds so it never drops back to "Thinking" once tools start —
  // throttled so fast tools don't flicker. The header narrates what's happening *now*,
  // so even the between-rounds fallback (a completed tool) keeps its present-tense form
  // ("Searching the web"), never the row's past-tense label ("Ran webSearch").
  const toolParts = segments.flatMap((s) => (s.type === "tool" ? s.parts : []));
  const runningTool = toolParts.find(
    (p) => p.state === "input-streaming" || p.state === "input-available",
  );
  const activeTool = runningTool ?? toolParts.at(-1);
  const askingCount =
    activeTool?.type === "tool-askUser"
      ? (((activeTool.input as { questions?: unknown[] } | undefined)?.questions ?? []).length ?? 0)
      : 0;
  const activeToolName = activeTool?.type.replace("tool-", "") ?? "";
  const activeToolConfig = DEFAULT_TOOL_LABELS[activeToolName];
  const streamingLabel = !activeTool
    ? "Thinking..."
    : activeTool.type === "tool-askUser"
      ? `Asking ${askingCount === 1 ? "question" : "questions"}`
      : (activeToolConfig?.active((activeTool.input as Record<string, unknown>) ?? {}) ??
        `Running ${activeToolName}`);
  // Hold each label past the roll animation (300ms) so a fast tool sequence reads as a
  // calm loop instead of overlapping mid-roll swaps.
  const shownLabel = useThrottledText(streamingLabel, 800);

  // Open while active, auto-collapse when done — but a user toggle wins from then on.
  const [userOpen, setUserOpen] = useState<boolean | null>(null);
  const open = userOpen ?? isActive;

  const doneLabel = `Thought for ${
    duration === undefined
      ? "a few seconds"
      : `${duration} ${duration === 1 ? "second" : "seconds"}`
  }${suffix}`;
  const displayLabel = isActive ? shownLabel : doneLabel;

  // One rolling label for both states — the box never changes when the stream ends, so
  // there's no layout shift: the last active label just rolls out and the summary rolls in
  // (roll matches the composer placeholder / TextLoop; shimmer only while active).
  const header = (
    <AnimatePresence mode="popLayout" initial={false}>
      <motion.span
        key={displayLabel}
        initial={{ opacity: 0, y: "100%", filter: "blur(4px)" }}
        animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
        exit={{ opacity: 0, y: "-100%", filter: "blur(4px)" }}
        transition={{ duration: 0.3, ease: "easeOut" }}
        className="block"
      >
        {isActive ? <TextShimmer>{displayLabel}</TextShimmer> : displayLabel}
      </motion.span>
    </AnimatePresence>
  );

  // Text-only turn (no reasoning/tools) — keep the status header, but there's nothing
  // to expand, so render it as a static line (no chevron, no disclosure).
  if (segments.length === 0) {
    return (
      <div className="flex w-full items-center py-1 text-ink-secondary text-sm">
        <span className="overflow-hidden text-left">{header}</span>
      </div>
    );
  }

  return (
    <Steps>
      <Steps.Item open={open} onOpenChange={setUserOpen}>
        <Steps.Trigger>
          <span className="overflow-hidden text-left">{header}</span>
          <ChevronDownIcon className="size-4 shrink-0 transition-transform group-data-open/steps-trigger:rotate-180" />
        </Steps.Trigger>
        <Steps.Panel>
          {segments.map((seg, i) => {
            if (seg.type === "reasoning") {
              const text = seg.parts.map((p) => p.text).join("");
              const lastPart = seg.parts.at(-1);
              const streaming = isActive && lastPart === segments.at(-1);

              const sections = splitReasoningByHeaders([text]);

              return sections.map((section, j) => (
                <TimelineStep
                  key={`r-${i}-${j}`}
                  label={section.header ?? "Thinking"}
                  status={streaming && j === sections.length - 1 ? "active" : "complete"}
                  icon={BrainIcon}
                >
                  {section.body && (
                    <Markdown className="text-sm leading-tight text-ink-secondary [&_p]:mb-0">
                      {section.body}
                    </Markdown>
                  )}
                </TimelineStep>
              ));
            }
            if (seg.type === "tool") {
              return seg.parts.map((part, j) =>
                part.type === "tool-askUser" ? (
                  <TimelineAskUser key={`a-${i}-${j}`} part={part} />
                ) : (
                  <TimelineToolCall key={`t-${i}-${j}`} part={part} />
                ),
              );
            }
            return null;
          })}
        </Steps.Panel>
      </Steps.Item>
    </Steps>
  );
};

type ChatMessageItemProps = {
  message: AppUIMessage;
  isLast: boolean;
  /** This message is the one currently streaming. */
  isStreaming: boolean;
  isError: boolean;
  skipAnimation: boolean;
};

// Memoized row boundary: finished messages keep their object identity across
// stream chunks, so every row except the streaming one bails here and the
// segmentation below runs once per chunk, not once per message. Do not spread
// the message object at the call site — a fresh object defeats the memo.
const ChatMessageItem = memo(
  ({ message, isLast, isStreaming, isError, skipAnimation }: ChatMessageItemProps) => {
    const { regenerate, addSelection } = useChatSession();
    const { parts } = message;
    const isAssistant = message.role === "assistant";
    const isUser = message.role === "user";

    const segments = getSegmentedParts(parts);
    const textInfo = getTextInfo(segments);
    const fileParts = getFileParts(segments);
    const chain = getChainInfo(segments);
    const reasoning = chain.onlyReasoning ? getReasoningInfo(segments, isStreaming) : null;
    const askUser = getAskUserInfo(parts);
    const sourcesInfo = isAssistant ? getSourcesInfo(parts) : null;

    // Every assistant turn keeps a status block, so it never appears-then-vanishes. A
    // finished reasoning-only turn uses the dedicated Reasoning disclosure; every other
    // assistant turn — streaming, tools, ask-user, or a plain text reply — uses
    // InterleavedSteps, which shows a "Thought for Xs" header even with an empty timeline.
    const isReasoningOnlyDone =
      isAssistant && !isStreaming && !chain.hasTools && !!reasoning && reasoning.parts.length > 0;

    const shouldShowReasoning = isReasoningOnlyDone;
    const shouldShowInterleavedReasoning = isAssistant && !isReasoningOnlyDone;

    return (
      <Message
        role={message.role}
        isError={isError}
        isLast={isLast}
        {...(skipAnimation && { initial: false })}
      >
        {/* File attachments */}
        {isUser && fileParts.length > 0 && (
          <Message.Attachments>
            {fileParts.map((part, i) => (
              <Message.Attachment key={i} attachment={part} />
            ))}
          </Message.Attachments>
        )}

        {/* Standalone reasoning (no tools) — suppress when panel handles it */}
        {shouldShowReasoning && (
          <Reasoning isStreaming={reasoning.isStreaming}>
            <Reasoning.Trigger label={reasoning.headers} />
            <Reasoning.Content>{reasoning.texts}</Reasoning.Content>
          </Reasoning>
        )}

        {/* Interleaved reasoning + tool chain — suppress when panel handles it */}
        {shouldShowInterleavedReasoning && (
          <InterleavedSteps
            segments={chain.segments}
            isStreaming={isStreaming}
            awaitingInput={askUser.isAwaitingInput}
          />
        )}

        {/* Message content */}
        <Message.Content>
          {parts.map((part, index) => {
            switch (part.type) {
              case "text": {
                // Hide intermediate text between tool calls — only
                // show text that appears after the last tool/reasoning part.
                if (chain.hasTools) {
                  const lastChainIdx = parts.findLastIndex(
                    (p) =>
                      p.type === "reasoning" ||
                      (p.type.startsWith("tool-") && p.type !== "tool-askUser"),
                  );
                  if (index <= lastChainIdx) return null;
                }
                if (isUser) {
                  return <Message.Text key={index}>{part.text}</Message.Text>;
                }
                return <Message.Markdown key={index}>{part.text}</Message.Markdown>;
              }
              default:
                return null;
            }
          })}
        </Message.Content>

        {/* Selection → context affordance (assistant text only) */}
        {isAssistant && <Message.Selection onAdd={addSelection} />}

        {/* Source URL pills */}
        {sourcesInfo?.hasSources && (
          <Message.Sources>
            {sourcesInfo.sources.map((source) => (
              <Message.Source key={source.domain} url={source.url} domain={source.domain} />
            ))}
          </Message.Sources>
        )}

        {/* Stopped marker — assistant turn the user aborted mid-stream */}
        {isAssistant && message.metadata?.stopped && <Message.Stopped />}

        {/* Actions — hide while waiting for tool input */}
        {!askUser.isAwaitingInput && (
          <Message.Actions>
            {isAssistant && (
              <Message.Action
                onClick={() => regenerate({ messageId: message.id })}
                tooltip="Regenerate"
              >
                <RefreshIcon />
              </Message.Action>
            )}
            <Message.Copy value={textInfo.text} />
          </Message.Actions>
        )}
      </Message>
    );
  },
);

ChatMessageItem.displayName = "ChatMessageItem";

const ChatMessages = () => {
  const { messages, status } = useChatMessages();
  const stickyMessages = useSettingsStore((s) => s.stickyMessages);
  const isError = status === "error";
  const isStreaming = status === "streaming";

  // Track messages present at mount — skip entrance animation for these
  const initialMessageIds = useRef(new Set(messages.map((m) => m.id)));

  const turns = groupTurns(messages);
  const lastMessageId = messages.at(-1)?.id;

  return (
    <>
      {turns.map((turn, turnIndex) => (
        <Message.Turn key={turn.key} sticky={stickyMessages}>
          {turn.messages.map((message) => (
            <ChatMessageItem
              key={message.id}
              message={message}
              isLast={message.id === lastMessageId}
              isStreaming={message.id === lastMessageId && isStreaming}
              isError={isError}
              skipAnimation={initialMessageIds.current.has(message.id)}
            />
          ))}
          {turnIndex === turns.length - 1 && isError && <Message.Error />}
        </Message.Turn>
      ))}
      {/* Loading indicator — suppress when panel handles it */}
      {/* {isLoading && panelState.type !== "loading" && (
        <Reasoning isStreaming>
          <Reasoning.Trigger />
        </Reasoning>
      )} */}
    </>
  );
};

const MENTION_ITEMS: CommandItemData[] = [
  {
    value: "quarterly-report",
    label: "Q4 Quarterly Report",
    icon: "fileText",
  },
  {
    value: "meeting-notes",
    label: "Meeting Notes - March 2026",
    icon: "fileText",
  },
  {
    value: "product-roadmap",
    label: "Product Roadmap",
    icon: "spreadsheet",
  },
  {
    value: "brand-guidelines",
    label: "Brand Guidelines",
    icon: "fileText",
  },
  {
    value: "api-documentation",
    label: "API Documentation",
    icon: "fileChart",
  },
  {
    value: "screenshot-dashboard",
    label: "Screenshot - Dashboard",
    icon: "imageAlt",
  },
  {
    value: "wireframe-checkout",
    label: "Wireframe - Checkout Flow",
    icon: "imageAlt",
  },
];

// This app's composer panel-state union: idle, or the ask-user arm for its
// askUser tool. (Tool/step status moved to the assistant message.)
type AskUserPanelState = {
  type: "ask-user";
  toolCallId: string;
  questions: AskUserQuestion[];
};

type AppComposerPanelState = { type: "idle" } | AskUserPanelState;

// Stable idle reference so ChatInputInner's memo bails when nothing transitioned.
const IDLE_PANEL_STATE: AppComposerPanelState = { type: "idle" };

// App overlay: routes the composer panel to ask-user while this app's askUser
// tool awaits input. Detection runs on ready AND streaming — the chat goes
// "ready" while the tool waits. Referentially stable so the memoized inner
// composer bails per stream chunk.
const useAskUserPanelState = (
  messages: readonly AppUIMessage[],
  status: ChatStatus,
): AskUserPanelState | null => {
  const prevRef = useRef<AskUserPanelState | null>(null);

  const lastAssistant =
    status === "ready" || status === "streaming"
      ? messages.findLast((m) => m.role === "assistant")
      : undefined;
  // Widen to the package's structural part contract so the guard can narrow.
  const parts: readonly UnknownPart[] = lastAssistant?.parts ?? [];
  const part = parts.find(
    (p): p is ToolPart =>
      isToolPart(p) && p.type === "tool-askUser" && p.state === "input-available",
  );

  const next = part
    ? {
        type: "ask-user" as const,
        toolCallId: part.toolCallId,
        questions: ((part.input as AskUserInput | undefined)?.questions ?? []) as AskUserQuestion[],
      }
    : null;

  if (
    prevRef.current?.toolCallId === next?.toolCallId &&
    (prevRef.current === null) === (next === null)
  ) {
    return prevRef.current;
  }
  prevRef.current = next;
  return next;
};

// Thin bridge — the only composer piece that re-renders per stream chunk. It derives
// the ask-user panel state (referentially stable while nothing transitioned) so the
// memoized inner composer bails unless the panel actually changed. Idle otherwise —
// tool/step status now renders in the assistant message.
const ChatInput = () => {
  const { messages, status } = useChatMessages();
  const askUserPanelState = useAskUserPanelState(messages, status);
  return <ChatInputInner panelState={askUserPanelState ?? IDLE_PANEL_STATE} status={status} />;
};

type ChatInputInnerProps = {
  panelState: AppComposerPanelState;
  status: ChatStatus;
};

const ChatInputInner = memo(({ panelState, status }: ChatInputInnerProps) => {
  const {
    chatId,
    isEmpty,
    sendMessage,
    stop,
    setMessages,
    addToolOutput,
    selections,
    clearSelections,
  } = useChatSession();
  const router = useRouter();
  const isGenerating = status === "submitted" || status === "streaming";

  // Mark the in-flight turn stopped (or drop it if empty) in-memory for an
  // instant marker, then abort. onFinish re-applies the same transform when it
  // persists, so the saved copy matches regardless of ordering.
  const handleStop = useCallback(() => {
    setMessages((previous) => applyStopToMessages(previous));
    stop();
  }, [setMessages, stop]);
  const createChat = useChatStore((state) => state.createChat);
  const { model, setModel } = useModelStore();
  const [isSending, setIsSending] = useState(false);
  const [hasSubmitted, setHasSubmitted] = useState(false);
  const isNewChat = isEmpty;

  // Tool toggles (web search, thinking) are app state, not the composer's —
  // we own them here and feed them into the request body at submit time.
  const [toolValues, setToolValues] = useState<Record<string, boolean>>({});
  const setTool = useCallback((name: string, value: boolean) => {
    setToolValues((previous) => ({ ...previous, [name]: value }));
  }, []);

  const commandItems = useMemo<CommandItemData[]>(
    () => [
      {
        value: "webSearch",
        label: "Search the web",
        description: "Enable web search for this message",
        icon: "globe",
        keywords: "search web",
        onSelect: () => setTool("webSearch", true),
      },
      {
        value: "codeExecution",
        label: "Code Execution",
        description: "Run code snippets",
        icon: "code",
        keywords: "code run execute",
      },
      {
        value: "thinking",
        label: "Think deeply",
        description: "Enable extended thinking",
        icon: "brain",
        keywords: "think reasoning",
        onSelect: () => setTool("thinking", true),
      },
      {
        value: "summarize",
        label: "Summarize",
        description: "Summarize the conversation",
        icon: "bubbleWideSparkle",
        keywords: "summarize summary",
      },
    ],
    [setTool],
  );

  const isAskUser = panelState.type === "ask-user";
  const askUserQuestions = panelState.type === "ask-user" ? panelState.questions : null;

  const handleSubmit = useCallback(
    async (data: ComposerSubmitData) => {
      if (data.kind === "answers") {
        if (panelState.type !== "ask-user") return;
        // Project the composer's per-question entries into a question→answer map — the
        // shape the tool output is read back as (getAskUserInfo / getAskUserStepInfo).
        const answers: Record<string, string> = {};
        for (const entry of data.answers) {
          if ("options" in entry) {
            answers[entry.question] = [...entry.options, entry.text].filter(Boolean).join(", ");
          } else if ("option" in entry) {
            answers[entry.question] = entry.option;
          } else if ("text" in entry) {
            answers[entry.question] = entry.text;
          }
        }
        addToolOutput({
          tool: "askUser",
          toolCallId: panelState.toolCallId,
          output: JSON.stringify(answers),
        });
        return;
      }

      setIsSending(true);
      try {
        setHasSubmitted(true);

        if (isNewChat) {
          const title = data.text.slice(0, 50) || "New Chat";
          createChat(chatId, title);
          router.replace(`/chat/${chatId}`);
        }

        // Fold thread selections in as blockquote context above the question.
        const quoted = selections
          .map((selection) =>
            selection.text
              .split("\n")
              .map((line) => `> ${line}`)
              .join("\n"),
          )
          .join("\n\n");
        // Attachments-only submits arrive with empty text — this app's copy.
        const messageText = data.text || "Sent with attachments";
        const text = quoted ? `${quoted}\n\n${messageText}` : messageText;

        // The composer submits generic attachment items; adapt them to AI SDK
        // file parts (inlining blob URLs) at this app boundary.
        const fileParts = await prepareAttachmentsForSend(data.files);

        await sendMessage(
          {
            parts: [...fileParts, { type: "text", text }],
          },
          {
            body: {
              webSearch: toolValues.webSearch ?? false,
              thinking: toolValues.thinking ?? false,
            },
          },
        );
        clearSelections();
      } finally {
        setIsSending(false);
      }
    },
    [
      chatId,
      createChat,
      isNewChat,
      router,
      sendMessage,
      addToolOutput,
      panelState,
      toolValues,
      selections,
      clearSelections,
    ],
  );

  return (
    <Composer
      onSubmit={handleSubmit}
      isSubmitting={isSending}
      commands={{
        "@": {
          kind: "insert",
          trigger: "after-whitespace",
          items: MENTION_ITEMS,
        },
        "/": {
          kind: "execute",
          trigger: "doc-start",
          items: commandItems,
        },
      }}
      questions={askUserQuestions ?? undefined}
    >
      <Composer.Panel>
        {(composer) => {
          // One at a time, by priority: an active command list wins, else the
          // composer's own ask-user flow. (Tool/step status now lives in the
          // assistant message, not the composer.)
          if (composer.commands.active) {
            return (
              <>
                <Composer.Commands prefix="@" />
                <Composer.Commands prefix="/" />
              </>
            );
          }
          if (composer.askUser.active) return <Composer.AskUser />;
          return null;
        }}
      </Composer.Panel>

      <Composer.ContextWindow>
        {selections.length > 0 && (
          <div data-slot="chat-selections" className="flex items-center gap-1.5 text-ink-secondary">
            <OpenQuote2Icon className="size-3.5" />
            <span>
              {selections.length} selection{selections.length === 1 ? "" : "s"}
            </span>
            <button
              type="button"
              aria-label="Clear selections"
              className="cursor-pointer rounded-full p-0.5 hover:bg-primary-hover hover:text-ink-primary"
              onClick={clearSelections}
            >
              <CrossMediumIcon className="size-3" />
            </button>
          </div>
        )}
      </Composer.ContextWindow>
      <Composer.Container>
        <Composer.Attachments />
        <Composer.Textarea autoFocus>
          <Composer.Placeholder
            placeholder={
              isAskUser
                ? "Or type your own answer..."
                : !hasSubmitted
                  ? [
                      "Ask me anything...",
                      "Recall past conversations...",
                      "Search the web...",
                      "Generate a report...",
                      "Explain a concept...",
                      "Help with a project...",
                      "Give a tutorial...",
                      "Provide a recommendation...",
                      "Translate text...",
                      "Summarize a document...",
                      "Write a story...",
                      "Create a presentation...",
                    ]
                  : "Ask a follow-up question..."
            }
          />
        </Composer.Textarea>
        {isAskUser ? (
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
            <Composer.Submit isGenerating={isGenerating} onStop={handleStop} />
          </Composer.Actions>
        )}
      </Composer.Container>
    </Composer>
  );
});

ChatInputInner.displayName = "ChatInputInner";

const ChatPlaceholder = () => {
  const variants = {
    hidden: { opacity: 0, y: 8, filter: "blur(4px)" },
    visible: { opacity: 1, y: 0, filter: "blur(0px)" },
  };

  return (
    <AnimatePresence>
      <motion.div
        variants={variants}
        initial="hidden"
        animate="visible"
        exit="hidden"
        transition={{
          duration: 0.5,
          ease: "easeOut",
          delayChildren: stagger(0.1, { from: "first", startDelay: 0.15 }),
        }}
        className="flex flex-col items-center justify-center gap-4"
      >
        <motion.div variants={variants}>
          <IntentfaceLogo className="size-12" />
        </motion.div>
        <div className="flex flex-col items-center justify-center">
          <motion.span variants={variants} className="text-lg font-semibold">
            Intentface Chat
          </motion.span>
          <motion.span variants={variants} className="text-sm text-ink-secondary">
            Start a conversation
          </motion.span>
        </div>
      </motion.div>
    </AnimatePresence>
  );
};

// memo: ChatRoot re-renders on every stream chunk and re-creates this element;
// with no props the memo always bails, so the Thread chrome (header, overlays,
// composer dock) renders only when the session context actually changes.
const ChatDefaultLayout = memo(() => {
  const { isEmpty } = useChatSession();
  const scrollMode = useSettingsStore((s) => s.scrollMode);

  return (
    <>
      {/* Auto-scroll behavior is driven by the user's setting: "bottom" lands the
          newest turn at the bottom and follows, "jump" lands it at the top without
          following, "follow" lands at the top and follows, "off" disables it. */}
      <Thread autoScroll={scrollMode}>
        <Header />
        <Thread.Overlay direction="top" />
        <Thread.Viewport>
          {isEmpty ? (
            <Thread.Placeholder>
              <ChatPlaceholder />
            </Thread.Placeholder>
          ) : (
            <ChatMessages />
          )}
        </Thread.Viewport>
        <Thread.Composer>
          <Thread.ScrollButton />
          <ChatInput />
        </Thread.Composer>
        <Thread.Overlay direction="bottom" />
      </Thread>
    </>
  );
});

ChatDefaultLayout.displayName = "ChatDefaultLayout";

type ChatProps = {
  chatId: string;
  children?: React.ReactNode;
};

const ChatRoot = ({ chatId, children }: ChatProps) => {
  const { messages, status, sendMessage, regenerate, stop, setMessages, addToolOutput } =
    useChatInstance(chatId);

  // Thread selections (Message.Selection) — chat-level state: written
  // from the messages, read by the composer input at submit time.
  const [selections, setSelections] = useState<ChatSelection[]>([]);
  const addSelection = useCallback((text: string) => {
    setSelections((previous) => [...previous, { id: crypto.randomUUID(), text }]);
  }, []);
  const clearSelections = useCallback(() => {
    setSelections([]);
  }, []);

  const isEmpty = messages.length === 0;

  // Memoized so its identity survives the per-chunk ChatRoot re-render —
  // stream chunks change `messages`, not any of these deps.
  const session = useMemo<ChatSessionValue>(
    () => ({
      chatId,
      isEmpty,
      sendMessage,
      regenerate,
      stop,
      setMessages,
      addToolOutput,
      selections,
      addSelection,
      clearSelections,
    }),
    [
      chatId,
      isEmpty,
      sendMessage,
      regenerate,
      stop,
      setMessages,
      addToolOutput,
      selections,
      addSelection,
      clearSelections,
    ],
  );

  const messagesValue = useMemo<ChatMessagesValue>(
    () => ({ messages, status }),
    [messages, status],
  );

  return (
    <ChatSessionContext value={session}>
      <ChatMessagesContext value={messagesValue}>
        {children ?? <ChatDefaultLayout />}
      </ChatMessagesContext>
    </ChatSessionContext>
  );
};

export const Chat = Object.assign(ChatRoot, {
  Messages: ChatMessages,
  Input: ChatInput,
});
