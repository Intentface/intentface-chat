"use client";

import type { UIMessage } from "ai";
import { Message } from "./message";

export const Messages = ({ messages }: { messages: UIMessage[] }) => {
  return messages.map((message) => {
    const hasError = message.status === "error" || message.error != null;
    const isLoading = message.status === "in_progress";
    const isEmpty = !message.parts || message.parts.length === 0;

    return (
      <Message
        key={message.id}
        role={message.role}
        messageId={message.id}
        hasError={hasError}
        isLoading={isLoading}
      >
        <Message.Content>
          {hasError && message.error && (
            <Message.Error>
              {typeof message.error === "string"
                ? message.error
                : message.error.message || "An error occurred"}
            </Message.Error>
          )}
          {isLoading && isEmpty && <Message.Loading />}
          {message.parts?.map((part, index) => {
            switch (part.type) {
              case "text":
                return <Message.Text key={index}>{part.text}</Message.Text>;
              default:
                return null;
            }
          })}
        </Message.Content>
      </Message>
    );
  });
};
