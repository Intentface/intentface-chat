"use client";

import type { UseChatHelpers } from "@ai-sdk/react";
import type { ChatStatus, FileUIPart, UIMessage } from "ai";
import { CircleDotIcon, Loader } from "lucide-react";
import { AnimatePresence, motion, stagger } from "motion/react";
import { useRouter } from "next/navigation";
import {
  createContext,
  use,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { ArtifactCard } from "@/components/ai/artifact-card";
import { Composer, useComposer } from "@/components/ai/composer";
import { Message } from "@/components/ai/message";
import { Reasoning } from "@/components/ai/reasoning";
import { StepQueue } from "@/components/ai/step-queue";
import { Steps } from "@/components/ai/steps";
import { Thread } from "@/components/ai/thread";
import { ChatArtifactsPanel } from "@/components/artifacts-panel";
import { ActiveTools, ToolsMenu } from "@/components/composer-tools";
import { Header } from "@/components/header";
import { BrainIcon } from "@/components/icons/brain";
import { RefreshIcon } from "@/components/icons/refresh";
import { ModelSelector } from "@/components/model-selector";
import { DiffusionMarkdown } from "@/components/ui/diffusion-markdown";
import {
  type ComposerPanelState,
  useActiveComposerState,
} from "@/hooks/use-active-composer-state";
import { useChatInstance } from "@/hooks/use-chat-instance";
import {
  getAskUserInfo,
  getChainInfo,
  getFileParts,
  getReasoningInfo,
  getSegmentedParts,
  getSourcesInfo,
  getTextInfo,
  type MessageSegment,
  splitReasoningByHeaders,
} from "@/lib/message-utils";
import { useChatStore } from "@/lib/store/chat";
import { useModelStore } from "@/lib/store/model";
import { cn } from "@/lib/utils";
import { IntentfaceLogo } from "./icons/intentface-logo";
import { TextShimmer } from "./ui/text-shimmer";

export type Artifact = {
  id: string;
  title: string;
  content: string;
};

type ChatContextValue = {
  chatId: string;
  messages: UIMessage[];
  status: ChatStatus;
  sendMessage: UseChatHelpers<UIMessage>["sendMessage"];
  regenerate: UseChatHelpers<UIMessage>["regenerate"];
  stop: UseChatHelpers<UIMessage>["stop"];
  setMessages: UseChatHelpers<UIMessage>["setMessages"];
  addToolOutput: UseChatHelpers<UIMessage>["addToolOutput"];
  activeArtifact: Artifact | null;
  isArtifactOpen: boolean;
  openArtifact: (artifact: Artifact) => void;
  toggleArtifact: (artifact: Artifact) => void;
  closeArtifact: () => void;
};

const ChatContext = createContext<ChatContextValue | null>(null);

export const useChatContext = (): ChatContextValue => {
  const ctx = use(ChatContext);
  if (!ctx) {
    throw new Error("useChatContext must be used within a <Chat> provider");
  }
  return ctx;
};

// ---------------------------------------------------------------------------
// InterleavedSteps — renders reasoning + tools chronologically
// ---------------------------------------------------------------------------

const InterleavedSteps = ({
  segments,
  isStreaming,
}: {
  segments: MessageSegment[];
  isStreaming: boolean;
}) => {
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
  if (toolCount > 0)
    suffixes.push(`used ${toolCount} tool${toolCount !== 1 ? "s" : ""}`);
  if (questionCount > 0)
    suffixes.push(
      `asked ${questionCount} question${questionCount !== 1 ? "s" : ""}`,
    );
  const suffix = suffixes.length > 0 ? `, ${suffixes.join(", ")}` : "";

  const header = isStreaming ? (
    <TextShimmer>Thinking...{suffix}</TextShimmer>
  ) : (
    <span>
      Thought for {duration ?? "a few"} seconds{suffix}
    </span>
  );

  return (
    <Steps defaultOpen={isStreaming}>
      <Steps.Header>{header}</Steps.Header>
      <Steps.Content>
        {segments.map((seg, i) => {
          if (seg.type === "reasoning") {
            const text = seg.parts.map((p) => p.text).join("");
            const lastPart = seg.parts.at(-1);
            const streaming = isStreaming && lastPart === segments.at(-1);

            const sections = splitReasoningByHeaders([text]);

            return sections.map((section, j) => (
              <Steps.Step
                key={`r-${i}-${j}`}
                label={section.header ?? "Thinking"}
                status={
                  streaming && j === sections.length - 1 ? "active" : "complete"
                }
                icon={BrainIcon}
              >
                {section.body && <Steps.Body>{section.body}</Steps.Body>}
              </Steps.Step>
            ));
          }
          if (seg.type === "tool") {
            return seg.parts.map((part, j) =>
              part.type === "tool-askUser" ? (
                <Steps.AskUser key={`a-${i}-${j}`} part={part} />
              ) : (
                <Steps.ToolCall key={`t-${i}-${j}`} part={part} />
              ),
            );
          }
          return null;
        })}
      </Steps.Content>
    </Steps>
  );
};

const ChatMessages = () => {
  const { messages, status, regenerate, toggleArtifact } = useChatContext();
  const model = useModelStore((state) => state.model);
  const isDiffusionModel = model === "mercury-2-diffusing";
  const isError = status === "error";
  const isLoading = status === "submitted";
  const isStreaming = status === "streaming";

  // Derive panel state to know what the panel is handling
  // const panelState = useActiveComposerState(messages, status);
  // const panelActive = panelState.type !== "idle";

  // Track messages present at mount — skip entrance animation for these
  const initialMessageIds = useRef(new Set(messages.map((m) => m.id)));

  return (
    <>
      {messages.map(({ parts, ...message }, messageIndex, messageArray) => {
        const isLastMessage = messageIndex === messageArray.length - 1;
        const isAssistant = message.role === "assistant";
        const isUser = message.role === "user";
        const skipAnimation = initialMessageIds.current.has(message.id);
        const isMessageStreaming = isLastMessage && isStreaming;

        const segments = getSegmentedParts(parts);
        const textInfo = getTextInfo(segments);
        const fileParts = getFileParts(segments);
        const chain = getChainInfo(segments);
        const reasoning = chain.onlyReasoning
          ? getReasoningInfo(segments, isMessageStreaming)
          : null;
        const askUser = getAskUserInfo(parts);
        const sourcesInfo = isAssistant ? getSourcesInfo(parts) : null;

        // Only show reasoning/tools inline after the message has finished streaming
        const shouldShowReasoning =
          isAssistant &&
          reasoning &&
          reasoning.parts.length > 0 &&
          !isMessageStreaming &&
          !askUser.isAwaitingInput;

        const shouldShowInterleavedReasoning =
          isAssistant &&
          chain.hasTools &&
          !isMessageStreaming &&
          !askUser.isAwaitingInput;

        return (
          <Message
            key={message.id}
            role={message.role}
            isError={isError}
            isLast={isLastMessage}
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
                isStreaming={isMessageStreaming}
              />
            )}

            {/* Message content */}
            <Message.Content>
              {isDiffusionModel && textInfo.isDiffusing && textInfo.lastPart ? (
                <DiffusionMarkdown
                  content={textInfo.lastPart.text}
                  isStreaming={isMessageStreaming}
                />
              ) : (
                parts.map((part, index) => {
                  switch (part.type) {
                    case "text": {
                      // Hide intermediate text between tool calls — only
                      // show text that appears after the last tool/reasoning part.
                      if (chain.hasTools) {
                        const lastChainIdx = parts.findLastIndex(
                          (p) =>
                            p.type === "reasoning" ||
                            (p.type.startsWith("tool-") &&
                              p.type !== "tool-askUser"),
                        );
                        if (index <= lastChainIdx) return null;
                      }
                      return (
                        <Message.Text key={index}>{part.text}</Message.Text>
                      );
                    }
                    case "tool-createArtifact": {
                      const input = part.input as {
                        title?: string;
                        content?: string;
                      };
                      return (
                        <ArtifactCard
                          key={part.toolCallId}
                          title={input?.title ?? "Untitled"}
                          state={part.state}
                          onToggle={() =>
                            toggleArtifact({
                              id: part.toolCallId,
                              title: input?.title ?? "Untitled",
                              content: input?.content ?? "",
                            })
                          }
                        />
                      );
                    }
                    default:
                      return null;
                  }
                })
              )}
            </Message.Content>

            {/* Source URL pills */}
            {sourcesInfo?.hasSources && (
              <Message.Sources>
                {sourcesInfo.sources.map((source) => (
                  <Message.Source
                    key={source.domain}
                    url={source.url}
                    domain={source.domain}
                  />
                ))}
              </Message.Sources>
            )}

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
      })}
      {/* Loading indicator — suppress when panel handles it */}
      {/* {isLoading && panelState.type !== "loading" && (
        <Reasoning isStreaming>
          <Reasoning.Trigger />
        </Reasoning>
      )} */}
      {isError && <Message.Error />}
      <Thread.Spacer />
    </>
  );
};

const ComposerPanel = ({ panelState }: { panelState: ComposerPanelState }) => {
  const { mentions, commands } = useComposer();

  const statesValue =
    mentions.open || commands.open ? "command-list" : panelState.type;

  return (
    <Composer.States value={statesValue}>
      <Composer.State value="command-list">
        <Composer.CommandList />
      </Composer.State>
      <Composer.State value="active">
        <StepQueue>
          {panelState.type === "active" &&
            panelState.steps.map((step, i) => {
              const active = i === panelState.steps.length - 1;
              return (
                <StepQueue.Item key={step.key}>
                  <StepQueue.Icon>
                    {step.kind === "thinking" ? (
                      <BrainIcon
                        className={cn("size-3.5", active && "animate-pulse")}
                      />
                    ) : active ? (
                      <Loader className="size-3.5 animate-spin" />
                    ) : (
                      <CircleDotIcon className="size-3.5" />
                    )}
                  </StepQueue.Icon>
                  <StepQueue.Label active={active}>
                    {step.label}
                  </StepQueue.Label>
                </StepQueue.Item>
              );
            })}
        </StepQueue>
      </Composer.State>
      <Composer.State value="ask-user">
        <Composer.Questionnaire />
      </Composer.State>
    </Composer.States>
  );
};

const ChatInput = () => {
  const { chatId, messages, sendMessage, status, addToolOutput } =
    useChatContext();
  const router = useRouter();
  const createChat = useChatStore((state) => state.createChat);
  const { model, setModel } = useModelStore();
  const [isSending, setIsSending] = useState(false);
  const [hasSubmitted, setHasSubmitted] = useState(false);
  const isNewChat = !messages.length;

  const panelState = useActiveComposerState(messages, status);
  const isAskUser = panelState.type === "ask-user";

  const handleAskUserSubmit = useCallback(
    (answers: Record<string, string>) => {
      if (panelState.type !== "ask-user") return;
      addToolOutput({
        tool: "askUser",
        toolCallId: panelState.toolCallId,
        output: JSON.stringify(answers),
      });
    },
    [panelState, addToolOutput],
  );

  const handleSubmit = useCallback(
    async ({
      text,
      files,
      webSearch,
      thinking,
    }: {
      text: string;
      files: FileUIPart[];
      webSearch: boolean;
      thinking: boolean;
    }) => {
      setIsSending(true);
      try {
        setHasSubmitted(true);

        if (isNewChat) {
          const title = text.slice(0, 50) || "New Chat";
          createChat(chatId, title);
          router.replace(`/chat/${chatId}`);
        }

        await sendMessage(
          { text, files },
          {
            body: { webSearch, thinking },
          },
        );
      } finally {
        setIsSending(false);
      }
    },
    [chatId, createChat, isNewChat, router, sendMessage],
  );

  return (
    <Composer
      onSubmit={handleSubmit}
      isSubmitting={isSending}
      questions={isAskUser ? panelState.questions : undefined}
      onQuestionsSubmit={handleAskUserSubmit}
    >
      <ComposerPanel panelState={panelState} />
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
          <Composer.Actions className="flex items-center justify-end">
            <Composer.Hints />
            <Composer.DismissAction />
            <Composer.ContinueAction />
          </Composer.Actions>
        ) : (
          <Composer.Actions className="flex items-center justify-between">
            <div className="flex items-center">
              <ToolsMenu />
              <ModelSelector value={model} onValueChange={setModel} />
              <ActiveTools />
            </div>
            <Composer.Submit />
          </Composer.Actions>
        )}
      </Composer.Container>
    </Composer>
  );
};

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
          <motion.span
            variants={variants}
            className="text-sm text-ink-secondary"
          >
            Start a conversation
          </motion.span>
        </div>
      </motion.div>
    </AnimatePresence>
  );
};

const ChatDefaultLayout = () => {
  const { messages } = useChatContext();
  const isEmpty = messages.length === 0;

  return (
    <>
      <Thread>
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
      <ChatArtifactsPanel />
    </>
  );
};

type ChatProps = {
  chatId: string;
  children?: React.ReactNode;
};

const ChatRoot = ({ chatId, children }: ChatProps) => {
  const {
    messages,
    status,
    sendMessage,
    regenerate,
    stop,
    setMessages,
    addToolOutput,
  } = useChatInstance(chatId);

  // Artifact panel state — local to this chat, resets on remount
  const [activeArtifact, setActiveArtifact] = useState<Artifact | null>(null);
  const [isArtifactOpen, setIsArtifactOpen] = useState(false);

  const openArtifact = useCallback((artifact: Artifact) => {
    setActiveArtifact(artifact);
    setIsArtifactOpen(true);
  }, []);

  const toggleArtifact = useCallback(
    (artifact: Artifact) => {
      if (isArtifactOpen && activeArtifact?.id === artifact.id) {
        setIsArtifactOpen(false);
      } else {
        setActiveArtifact(artifact);
        setIsArtifactOpen(true);
      }
    },
    [activeArtifact?.id, isArtifactOpen],
  );

  const closeArtifact = useCallback(() => {
    setIsArtifactOpen(false);
  }, []);

  const value: ChatContextValue = {
    chatId,
    messages,
    status,
    sendMessage,
    regenerate,
    stop,
    setMessages,
    addToolOutput,
    activeArtifact,
    isArtifactOpen,
    openArtifact,
    toggleArtifact,
    closeArtifact,
  };

  return (
    <ChatContext value={value}>{children ?? <ChatDefaultLayout />}</ChatContext>
  );
};

export const Chat = Object.assign(ChatRoot, {
  Messages: ChatMessages,
  Input: ChatInput,
  Artifacts: ChatArtifactsPanel,
});
