"use client";

import { useState } from "react";
import { Composer } from "@/components/ai/composer";
import { Message } from "@/components/ai/message";
import { Thread } from "@/components/ai/thread";

type DemoMessage = {
  id: string;
  role: "user" | "assistant";
  text: string;
};

export const IntentfaceChatDemo = () => {
  const [messages, setMessages] = useState<DemoMessage[]>([
    {
      id: "welcome",
      role: "assistant",
      text: "Ask a question to try the installed Intentface chat primitives.",
    },
  ]);

  return (
    <div className="h-[640px] rounded-lg border border-primary-border bg-secondary">
      <Thread>
        <Thread.Overlay direction="top" />
        <Thread.Viewport>
          {messages.map((message, index) => (
            <Message
              key={message.id}
              role={message.role}
              isLast={index === messages.length - 1}
              isError={false}
            >
              <Message.Content>
                {message.role === "user" ? (
                  <Message.Text>{message.text}</Message.Text>
                ) : (
                  <Message.Markdown>{message.text}</Message.Markdown>
                )}
              </Message.Content>
            </Message>
          ))}
        </Thread.Viewport>
        <Thread.Composer>
          <Composer
            onSubmit={(data) => {
              if (data.kind !== "message") return;
              setMessages((current) => [
                ...current,
                {
                  id: crypto.randomUUID(),
                  role: "user",
                  text: data.text,
                },
                {
                  id: crypto.randomUUID(),
                  role: "assistant",
                  text: "This demo only echoes the UI flow. Wire `Composer` to your AI SDK chat handler for streaming responses.",
                },
              ]);
            }}
          >
            <Composer.Container>
              <Composer.Textarea>
                <Composer.Placeholder placeholder="Message Intentface..." />
              </Composer.Textarea>
              <Composer.Actions>
                <Composer.Submit />
              </Composer.Actions>
            </Composer.Container>
          </Composer>
        </Thread.Composer>
        <Thread.ScrollButton />
      </Thread>
    </div>
  );
};
