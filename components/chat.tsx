"use client";

import type { UseChatHelpers } from "@ai-sdk/react";
import type { ChatStatus, FileUIPart, UIMessage } from "ai";
import { CircleDotIcon, Loader, PlusIcon, XIcon } from "lucide-react";
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
import { Header } from "@/components/header";
import { BrainIcon } from "@/components/icons/brain";
import { GlobeIcon } from "@/components/icons/globe";
import { PaperClipIcon } from "@/components/icons/paperclip";
import { RefreshIcon } from "@/components/icons/refresh";
import { ModelSelector } from "@/components/model-selector";
import { Questionnaire } from "@/components/questionnaire";
import { DiffusionMarkdown } from "@/components/ui/diffusion-markdown";
import DropdownMenu from "@/components/ui/dropdown-menu";
import { IconButton } from "@/components/ui/icon-button";
import { useActiveComposerState } from "@/hooks/use-active-composer-state";
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
import Button from "./ui/button";
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

const ActiveTools = () => {
  const { webSearch, setWebSearch, thinking, setThinking } = useComposer();

  return (
    <div className="flex items-center gap-px">
      {webSearch && (
        <Button
          type="button"
          variant="ghost"
          className="group/pill cursor-pointer rounded-full font-normal"
          onClick={() => setWebSearch(false)}
        >
          <span className="relative size-4">
            <GlobeIcon className="opacity-100 absolute top-0 left-0 group-hover/pill:opacity-0" />
            <XIcon className="opacity-0 absolute top-0 left-0 group-hover/pill:opacity-100" />
          </span>
          Web Search
        </Button>
      )}

      {thinking && (
        <Button
          type="button"
          variant="ghost"
          className="group/pill cursor-pointer rounded-full font-normal"
          onClick={() => setThinking(false)}
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

const ToolsMenu = () => {
  const { attachmentsApi, webSearch, setWebSearch, thinking, setThinking } =
    useComposer();

  return (
    <DropdownMenu>
      <DropdownMenu.Trigger
        render={
          <IconButton variant="ghost" type="button" className="rounded-full">
            <PlusIcon />
          </IconButton>
        }
      />
      <DropdownMenu.Content
        side="top"
        align="start"
        sideOffset={8}
        className="w-auto"
      >
        <DropdownMenu.Item
          onClick={() => attachmentsApi.current?.openFileDialog()}
        >
          <PaperClipIcon />
          <span className="flex-1">Attach files</span>
        </DropdownMenu.Item>
        <DropdownMenu.Separator />
        <DropdownMenu.SwitchItem
          checked={webSearch}
          onCheckedChange={setWebSearch}
        >
          <GlobeIcon /> <span className="flex-1">Web Search</span>
        </DropdownMenu.SwitchItem>
        <DropdownMenu.SwitchItem
          checked={thinking}
          onCheckedChange={setThinking}
        >
          <BrainIcon /> <span className="flex-1">Thinking</span>
        </DropdownMenu.SwitchItem>
      </DropdownMenu.Content>
    </DropdownMenu>
  );
};

const ComposerPanel = () => {
  const { messages, status, addToolOutput } = useChatContext();
  const panelState = useActiveComposerState(messages, status);

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

  return (
    <Composer.States>
      {panelState.type === "active" && (
        <Composer.State key="steps">
          <StepQueue>
            {panelState.steps.map((step, i) => {
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
      )}
      {panelState.type === "ask-user" && (
        <Composer.State key="ask-user">
          <Questionnaire onSubmit={handleAskUserSubmit}>
            <div className="flex items-center gap-1 self-end shrink-0">
              <Questionnaire.Previous />
              <Questionnaire.StepLabel />
              <Questionnaire.Next />
            </div>
            <Questionnaire.Content>
              {panelState.questions.map((q) => (
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
                  <Questionnaire.TextInput hasOptions={!!q.options?.length} />
                </Questionnaire.Step>
              ))}
              <Questionnaire.Review />
            </Questionnaire.Content>
            <Questionnaire.Actions />
          </Questionnaire>
        </Composer.State>
      )}
    </Composer.States>
  );
};

const ChatInput = () => {
  const { chatId, messages, sendMessage } = useChatContext();
  const router = useRouter();
  const createChat = useChatStore((state) => state.createChat);
  const { model, setModel } = useModelStore();
  const [isSending, setIsSending] = useState(false);
  const [hasSubmitted, setHasSubmitted] = useState(false);
  const isNewChat = !messages.length;

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
    <Composer onSubmit={handleSubmit} isSubmitting={isSending}>
      <ComposerPanel />
      <Composer.Container>
        <Composer.Attachments />
        <Composer.Textarea autoFocus>
          <Composer.Placeholder
            placeholder={
              !hasSubmitted
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
        <Composer.Actions className="flex items-center justify-between">
          <div className="flex items-center">
            <ToolsMenu />
            <ModelSelector value={model} onValueChange={setModel} />
            <ActiveTools />
          </div>
          <Composer.Submit />
        </Composer.Actions>
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
          <motion.span variants={variants} className="text-sm text-slate-11">
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
