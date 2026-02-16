"use client";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type FileUIPart } from "ai";
import { useMemo } from "react";
import { Messages } from "@/components/ai/messages";
import { Thread } from "@/components/ai/thread";
import { AppSidebar } from "@/components/app-sidebar";
import { ChatInput } from "@/components/chat-input";
import { Header } from "@/components/header";
import { Sidebar } from "@/components/ui/sidebar";
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

  const { messages, sendMessage, status, regenerate } = useChat({
    transport,
  });

  const handleSendMessage = async ({
    text,
    files,
  }: {
    text: string;
    files: FileUIPart[];
  }) => {
    await sendMessage({
      files,
      text,
    });
  };

  return (
    <Sidebar.Provider>
      <AppSidebar />
      <Sidebar.Inset>
        <Thread>
          <Header />
          <Thread.Overlay direction="top" />
          <Thread.Viewport>
            <Messages
              messages={messages}
              status={status}
              regenerate={regenerate}
            />
          </Thread.Viewport>
          <Thread.Composer>
            <Thread.ScrollButton />
            <ChatInput onSendMessage={handleSendMessage} />
          </Thread.Composer>
          <Thread.Overlay direction="bottom" />
        </Thread>
      </Sidebar.Inset>
    </Sidebar.Provider>
  );
}
