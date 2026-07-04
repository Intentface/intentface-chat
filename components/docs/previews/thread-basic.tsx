"use client";

import { useState } from "react";
import { Composer, type ComposerSubmitData } from "@/components/ai/composer";
import { Message } from "@/components/ai/message";
import { Thread } from "@/components/ai/thread";

type DemoMessage = { id: string; role: "user" | "assistant"; text: string };

// The full chat surface: scrolling thread + docked composer. The composer
// echoes a reply so the auto-scroll and scroll-to-bottom button are live. Its
// bare <Composer> owns an isolated store, keeping multiple demos independent.
export const ThreadBasic = () => {
  const [messages, setMessages] = useState<DemoMessage[]>([
    {
      id: "0-a",
      role: "assistant",
      text: "Send a message to see the thread follow the stream and the composer echo a reply.",
    },
  ]);

  const handleSubmit = (data: ComposerSubmitData) => {
    if (data.kind !== "message" || !data.text.trim()) return;
    const { text } = data;
    setMessages((current) => [
      ...current,
      { id: `${current.length}-u`, role: "user", text },
      { id: `${current.length}-a`, role: "assistant", text: `You said: “${text}”` },
    ]);
  };

  return (
    <div className="h-[440px] w-full max-w-xl overflow-hidden rounded-xl border border-primary-border bg-secondary [--thread-width:100%]">
      <Thread>
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
          <Composer onSubmit={handleSubmit}>
            <Composer.Container>
              <Composer.Textarea>
                <Composer.Placeholder placeholder="Message…" />
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
