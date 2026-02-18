"use client";

import { useChat } from "@ai-sdk/react";
import { useMemo } from "react";
import { getChatInstance } from "@/lib/chat-instance";

export const useChatInstance = (chatId: string) => {
  const chat = useMemo(() => getChatInstance(chatId), [chatId]);
  return useChat({ chat });
};
