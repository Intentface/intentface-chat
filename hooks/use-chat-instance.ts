"use client";

import { useChat } from "@ai-sdk/react";
import { useEffect, useMemo } from "react";
import { getChatInstance } from "@/lib/chat-instance";
import { useChatStore } from "@/lib/store/chat";

export const useChatInstance = (chatId: string) => {
  const chat = useMemo(() => getChatInstance(chatId), [chatId]);
  const helpers = useChat({ chat });

  // Load persisted messages after mount to avoid hydration mismatch
  // (localStorage is unavailable during SSR, so both server and client
  // start with empty messages, then hydrate from storage here)
  const { setMessages } = helpers;
  useEffect(() => {
    const stored = useChatStore.getState().getMessages(chatId);
    if (stored.length > 0) {
      setMessages(stored);
    }
  }, [chatId, setMessages]);

  return helpers;
};
