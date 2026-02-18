"use client";

import { useChat } from "@ai-sdk/react";
import type { FileUIPart } from "ai";
import { useRouter } from "next/navigation";
import { useCallback, useMemo, useRef } from "react";
import { Thread } from "@/components/ai/thread";
import { ChatInput } from "@/components/chat-input";
import { Header } from "@/components/header";
import { Messages } from "@/components/messages";
import { getChatInstance } from "@/lib/chat-instance";
import { useChatStore } from "@/lib/store/chat";

type ChatProps = {
  chatId: string;
};

export const Chat = ({ chatId }: ChatProps) => {
  const router = useRouter();
  const createChat = useChatStore((state) => state.createChat);
  const chat = useMemo(() => getChatInstance(chatId), [chatId]);
  const isNewChat = useRef(!chat.messages.length);

  const { messages, sendMessage, status, regenerate } = useChat({ chat });

  const handleSendMessage = useCallback(
    async ({ text, files }: { text: string; files: FileUIPart[] }) => {
      if (isNewChat.current) {
        const title = text.slice(0, 50) || "New Chat";
        createChat(chatId, title);
        isNewChat.current = false;
        router.replace(`/chat/${chatId}`);
      }
      await sendMessage({ files, text });
    },
    [chatId, createChat, router, sendMessage],
  );

  return (
    <Thread>
      <Header />
      <Thread.Overlay direction="top" />
      <Thread.Viewport>
        <Messages messages={messages} status={status} regenerate={regenerate} />
      </Thread.Viewport>
      <Thread.Composer>
        <Thread.ScrollButton />
        <ChatInput onSendMessage={handleSendMessage} />
      </Thread.Composer>
      <Thread.Overlay direction="bottom" />
    </Thread>
  );
};
