"use client";

import type { UIMessage } from "ai";
import { Message } from "./message";

export const Messages = ({ messages }: { messages: UIMessage[] }) => {
  return messages.map((message) => {
    return (
      <Message key={message.id} role={message.role} messageId={message.id}>
        <Message.Content>
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
