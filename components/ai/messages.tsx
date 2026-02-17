"use client";

import type { ChatRequestOptions, ChatStatus, UIMessage } from "ai";
import { RefreshIcon } from "../icons/refresh";
import { Message } from "./message";
import { Reasoning } from "./reasoning";

type Props = {
  messages: UIMessage[];
  status: ChatStatus;
  regenerate: (options: { messageId?: string } & ChatRequestOptions) => void;
};

export const Messages = ({ messages, status, regenerate }: Props) => {
  const isError = status === "error";
  const isLoading = status === "submitted";
  const isStreaming = status === "streaming";

  const handleRegenerate = (messageId: string) => {
    regenerate({ messageId });
  };

  return (
    <>
      {messages.map((message, messageIndex, messageArray) => {
        const isLastMessage = messageIndex === messageArray.length - 1;
        const isAssistant = message.role === "assistant";

        const messageText = message.parts
          ?.map((part) => (part.type === "text" ? part.text : ""))
          .join("");

        // Consolidate all reasoning parts into one block
        const reasoningParts = message.parts.filter(
          (part) => part.type === "reasoning",
        );
        const reasoningText = reasoningParts
          .map((part) => part.text)
          .join("\n\n");
        const hasReasoning = reasoningParts.length > 0;
        // Check if reasoning is still streaming (last part is reasoning on last message)
        const lastPart = message.parts.at(-1);
        const isReasoningStreaming =
          isLastMessage && isStreaming && lastPart?.type === "reasoning";

        return (
          <Message
            key={message.id}
            role={message.role}
            status={status}
            isLast={isLastMessage}
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
