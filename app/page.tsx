"use client";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { useMemo } from "react";
import { Conversation } from "@/components/ai/conversation";
import { Messages } from "@/components/ai/messages";
import { ChatInput } from "@/components/chat-input";
import { Header } from "@/components/header";
import { useModelStore } from "@/lib/store";

export default function Home() {
  const model = useModelStore((state) => state.model);

  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        body: () => ({ model }),
      }),
    [model],
  );

  const { messages, sendMessage, status, regenerate } = useChat({ transport });
  const isEmpty = messages.length === 0;

  const handleSendMessage = async (text: string) => {
    await sendMessage({ text });
  };

  return (
    <div className="relative h-dvh w-full">
      <Header />
      <Conversation>
        <Conversation.Content>
          <Messages
            messages={messages}
            status={status}
            regenerate={regenerate}
          />
        </Conversation.Content>
        <ChatInput onSendMessage={handleSendMessage} isEmpty={isEmpty} />
      </Conversation>
    </div>
  );
}
