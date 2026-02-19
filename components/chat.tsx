"use client";

import type { UseChatHelpers } from "@ai-sdk/react";
import type { ChatStatus, UIMessage } from "ai";
import { useRouter } from "next/navigation";
import { createContext, use, useCallback, useRef, useState } from "react";
import { ArtifactCard } from "@/components/ai/artifact-card";
import { Message } from "@/components/ai/message";
import {
  PromptInput,
  type PromptInputHandle,
  usePromptInputAttachments,
} from "@/components/ai/prompt-input";
import { Reasoning } from "@/components/ai/reasoning";
import { Thread } from "@/components/ai/thread";
import { ChatArtifactsPanel } from "@/components/artifacts-panel";
import { Header } from "@/components/header";
import { PaperClipIcon } from "@/components/icons/paperclip";
import { RefreshIcon } from "@/components/icons/refresh";
import { ModelSelector } from "@/components/model-selector";
import { IconButton } from "@/components/ui/icon-button";
import { useChatInstance } from "@/hooks/use-chat-instance";
import { useChatStore } from "@/lib/store/chat";
import { useModelStore } from "@/lib/store/model";

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
  const promptInputRef = useRef<PromptInputHandle>(null);
  const [message, setMessage] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [hasSubmitted, setHasSubmitted] = useState(false);
  const attachments = usePromptInputAttachments();
  const isNewChat = useRef(!messages.length);

  const handleSubmit = useCallback(
    async (e: React.SubmitEvent<HTMLFormElement>) => {
      e.preventDefault();
      e.stopPropagation();

      if (isSending) {
        return;
      }

      const trimmedText = message.trim();
      const hasText = trimmedText.length > 0;
      const hasAttachments = promptInputRef.current?.hasAttachments() ?? false;

      if (!(hasText || hasAttachments)) {
        return;
      }

      setIsSending(true);

      try {
        const submitText = hasText ? trimmedText : "Sent with attachments";
        const files = hasAttachments
          ? await (promptInputRef.current?.prepareAttachments() ??
              Promise.resolve([]))
          : [];

        promptInputRef.current?.clearAttachments();
        setMessage("");
        setHasSubmitted(true);

        if (isNewChat.current) {
          const title = submitText.slice(0, 50) || "New Chat";
          createChat(chatId, title);
          isNewChat.current = false;
          router.replace(`/chat/${chatId}`);
        }

        await sendMessage({ files, text: submitText });
      } finally {
        setIsSending(false);
      }
    },
    [chatId, createChat, isSending, message, router, sendMessage],
  );

  return (
    <form onSubmit={handleSubmit} className="w-full">
      <PromptInput ref={promptInputRef}>
        <PromptInput.Attachments />
        <PromptInput.Body>
          <PromptInput.Textarea value={message} onValueChange={setMessage}>
            <PromptInput.Placeholder
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
          </PromptInput.Textarea>
        </PromptInput.Body>
        <PromptInput.AttachmentsError />
        <PromptInput.Footer className="flex items-center justify-between">
          <div className="flex items-center gap-1">
            <IconButton
              onClick={attachments.openFileDialog}
              type="button"
              variant="ghost"
            >
              <PaperClipIcon />
            </IconButton>

            <ModelSelector value={model} onValueChange={setModel} />
          </div>
          <PromptInput.Submit
            disabled={
              (!message.trim() && attachments.files.length === 0) || isSending
            }
          />
        </PromptInput.Footer>
      </PromptInput>
    </form>
  );
};

const ChatDefaultLayout = () => (
  <>
    <Thread>
      <Header />
      <Thread.Overlay direction="top" />
      <Thread.Viewport>
        <ChatMessages />
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
