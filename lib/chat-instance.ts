import { Chat } from "@ai-sdk/react";
import { DefaultChatTransport, lastAssistantMessageIsCompleteWithToolCalls } from "ai";
import type { AppUIMessage } from "@/lib/ai/types";
import { useChatStore } from "@/lib/store/chat";
import { useModelStore } from "@/lib/store/model";

const instances = new Map<string, Chat<AppUIMessage>>();

export const getChatInstance = (chatId: string): Chat<AppUIMessage> => {
  const existing = instances.get(chatId);
  if (existing) return existing;

  const chat = new Chat<AppUIMessage>({
    id: chatId,
    transport: new DefaultChatTransport({
      body: () => ({ model: useModelStore.getState().model }),
    }),
    sendAutomaticallyWhen: lastAssistantMessageIsCompleteWithToolCalls,
    onFinish: ({ messages, isAbort, isError }) => {
      if (isAbort || isError) return;
      const store = useChatStore.getState();
      const exists = store.chats.some((c) => c.id === chatId);
      if (exists) {
        store.updateChatTimestamp(chatId);
      }
      store.setMessages(chatId, messages);
    },
  });

  instances.set(chatId, chat);
  return chat;
};

export const deleteChatInstance = (chatId: string): void => {
  instances.delete(chatId);
};
