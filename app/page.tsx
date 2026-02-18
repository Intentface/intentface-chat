"use client";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type FileUIPart } from "ai";
import { useMemo } from "react";
import { Thread } from "@/components/ai/thread";
import { AppSidebar } from "@/components/app-sidebar";
import { ArtifactsPanel } from "@/components/artifacts-panel";
import { ChatInput } from "@/components/chat-input";
import { Header } from "@/components/header";
import { Messages } from "@/components/messages";
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
        <Sidebar.Viewport>
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
          <ArtifactsPanel />
        </Sidebar.Viewport>
      </Sidebar.Inset>
    </Sidebar.Provider>
  );
}
