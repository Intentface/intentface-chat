"use client";

import type { MessageRole } from "@intentface/chat/types";
import { Message } from "@/components/ai/message";

// A user question and an assistant reply with a copy action. Self-contained —
// plain message data, no chat transport.
const MESSAGES: { id: string; role: MessageRole; text: string }[] = [
  { id: "q", role: "user", text: "How do I center a div?" },
  {
    id: "a",
    role: "assistant",
    text: "Use flexbox on the parent: `display: flex`, then `justify-content: center` and `align-items: center`.",
  },
];

export const MessageBasic = () => (
  <div className="flex w-full max-w-xl flex-col gap-4">
    {MESSAGES.map((message, index) => (
      <Message
        key={message.id}
        role={message.role}
        isLast={index === MESSAGES.length - 1}
        isError={false}
      >
        <Message.Content>
          {message.role === "user" ? (
            <Message.Text>{message.text}</Message.Text>
          ) : (
            <Message.Markdown>{message.text}</Message.Markdown>
          )}
        </Message.Content>
        {message.role === "assistant" && (
          <Message.Actions>
            <Message.Copy value={message.text} />
          </Message.Actions>
        )}
      </Message>
    ))}
  </div>
);
