"use client";

import type { UseChatHelpers } from "@ai-sdk/react";
import type { ChatStatus, FileUIPart, UIMessage } from "ai";
import { AnimatePresence, motion, stagger } from "motion/react";
import { useRouter } from "next/navigation";
import { createContext, use, useCallback, useRef, useState } from "react";
import { ArtifactCard } from "@/components/ai/artifact-card";
import { Composer } from "@/components/ai/composer";
import { Message } from "@/components/ai/message";
import { Reasoning } from "@/components/ai/reasoning";
import { Thread } from "@/components/ai/thread";
import { ChatArtifactsPanel } from "@/components/artifacts-panel";
import { Header } from "@/components/header";
import { RefreshIcon } from "@/components/icons/refresh";
import { ModelSelector } from "@/components/model-selector";
import { useChatInstance } from "@/hooks/use-chat-instance";
import { useChatStore } from "@/lib/store/chat";
import { useModelStore } from "@/lib/store/model";
import { IntentfaceLogo } from "./icons/intentface-logo";

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

const ChatMessages = () => {
  const { messages, status, regenerate, toggleArtifact } = useChatContext();
  const isError = status === "error";
  const isLoading = status === "submitted";
  const isStreaming = status === "streaming";

  // Track messages present at mount — skip entrance animation for these
  const initialMessageIds = useRef(new Set(messages.map((m) => m.id)));

  const handleRegenerate = (messageId: string) => {
    regenerate({ messageId });
  };

  return (
    <>
      {messages.map((message, messageIndex, messageArray) => {
        const isLastMessage = messageIndex === messageArray.length - 1;
        const isAssistant = message.role === "assistant";
        const skipAnimation = initialMessageIds.current.has(message.id);

        const messageText = message.parts
          ?.map((part) => (part.type === "text" ? part.text : ""))
          .join("");

        const reasoningParts = message.parts.filter(
          (part) => part.type === "reasoning",
        );
        const reasoningText = reasoningParts
          .map((part) => part.text)
          .join("\n\n");
        const hasReasoning = reasoningParts.length > 0;
        const lastPart = message.parts.at(-1);
        const isReasoningStreaming =
          isLastMessage && isStreaming && lastPart?.type === "reasoning";

        return (
          <Message
            key={message.id}
            role={message.role}
            isError={isError}
            isLast={isLastMessage}
            {...(skipAnimation && { initial: false })}
          >
            <Message.Content>
              {hasReasoning && (
                <Reasoning isStreaming={isReasoningStreaming}>
                  <Reasoning.Trigger />
                  <Reasoning.Content>{reasoningText}</Reasoning.Content>
                </Reasoning>
              )}
              {message.parts?.map((part, index) => {
                switch (part.type) {
                  case "text":
                    return <Message.Text key={index}>{part.text}</Message.Text>;
                  case "tool-createArtifact": {
                    const input = part.input as {
                      title?: string;
                      content?: string;
                    };
                    {
                      const artifact = {
                        id: part.toolCallId,
                        title: input?.title ?? "Untitled",
                        content: input?.content ?? "",
                      };
                      return (
                        <ArtifactCard
                          key={index}
                          title={artifact.title}
                          state={part.state}
                          onToggle={() => toggleArtifact(artifact)}
                        />
                      );
                    }
                  }
                  default:
                    return null;
                }
              })}
            </Message.Content>
            <Message.Actions>
              {isAssistant && (
                <Message.Action
                  onClick={() => handleRegenerate(message.id)}
                  tooltip="Regenerate"
                >
                  <RefreshIcon />
                </Message.Action>
              )}
              <Message.Copy value={messageText} />
            </Message.Actions>
          </Message>
        );
      })}
      {isLoading && <Message.Loading />}
      {isError && <Message.Error />}
    </>
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
    async ({ text, files }: { text: string; files: FileUIPart[] }) => {
      setIsSending(true);
      try {
        setHasSubmitted(true);

        if (isNewChat) {
          const title = text.slice(0, 50) || "New Chat";
          createChat(chatId, title);
          router.replace(`/chat/${chatId}`);
        }

        await sendMessage({ text, files });
      } finally {
        setIsSending(false);
      }
    },
    [chatId, createChat, isNewChat, router, sendMessage],
  );
  return (
    <Composer onSubmit={handleSubmit} isSubmitting={isSending}>
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
      <Composer.Footer className="flex items-center justify-between">
        <div className="flex items-center gap-1">
          <Composer.AttachmentTrigger />
          <ModelSelector value={model} onValueChange={setModel} />
        </div>
        <Composer.Submit />
      </Composer.Footer>
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
        {isEmpty ? (
          <Thread.Placeholder>
            <ChatPlaceholder />
          </Thread.Placeholder>
        ) : (
          <Thread.Viewport>
            <ChatMessages />
          </Thread.Viewport>
        )}
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
  const { messages, status, sendMessage, regenerate, stop, setMessages } =
    useChatInstance(chatId);

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
