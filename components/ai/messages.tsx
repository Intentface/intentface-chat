"use client";

import type { ChatStatus, UIMessage } from "ai";
import { Message } from "./message";

type Props = {
  messages: UIMessage[];
  status: ChatStatus;
};

export const Messages = ({ messages, status }: Props) => {
  return messages.map((message) => {
    return (
      <Message key={message.id} role={message.role} messageId={message.id}>
        <Message.Content>
          {message.parts?.map((part, index) => {
            switch (part.type) {
              case "text":
                return (
                  <Message.Text
                    key={index}
                    isAnimating={status === "streaming"}
                  >
                    {part.text}
                  </Message.Text>
                );
              default:
                return null;
            }
          })}
        </Message.Content>
      </Message>
    );
  });
};
