"use client";

import { useState } from "react";
import { Composer, type ComposerSubmitData } from "@/components/ai/composer";
import { Message } from "@/components/ai/message";
import { Thread } from "@/components/ai/thread";

type DemoMessage = { id: string; role: "user" | "assistant"; text: string };

// The full chat surface: a scrolling thread with a conversation already in
// progress and a docked composer that appends new turns — auto-scroll and the
// scroll-to-bottom button stay live. Its bare <Composer> owns an isolated store.
const INITIAL: DemoMessage[] = [
  { id: "1", role: "user", text: "What's the difference between `useMemo` and `useCallback`?" },
  {
    id: "2",
    role: "assistant",
    text: "`useMemo` caches a computed **value**; `useCallback` caches a **function** reference. In fact `useCallback(fn, deps)` is just `useMemo(() => fn, deps)`.",
  },
  { id: "3", role: "user", text: "So when do I actually need useCallback?" },
  {
    id: "4",
    role: "assistant",
    text: "Mainly when you pass a callback to a `memo`-wrapped child or as another hook's dependency — a fresh function each render would break their memoization. Otherwise you usually don't.",
  },
];

const REPLY =
  "Good question — the short answer is it depends on what you're optimizing for. Want me to go deeper on any part?";

export const ThreadBasic = () => {
  const [messages, setMessages] = useState<DemoMessage[]>(INITIAL);

  const handleSubmit = (data: ComposerSubmitData) => {
    if (data.kind !== "message" || !data.text.trim()) return;
    setMessages((current) => [
      ...current,
      { id: `${current.length}-u`, role: "user", text: data.text },
      { id: `${current.length}-a`, role: "assistant", text: REPLY },
    ]);
  };

  return (
    <div className="h-[440px] w-full max-w-xl overflow-hidden rounded-xl border border-primary-border bg-secondary-bg [--thread-width:100%]">
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
                <Composer.Placeholder placeholder="Ask a follow-up…" />
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
