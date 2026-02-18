import { Chat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import { useChatStore } from "@/lib/store/chat";
import { useModelStore } from "@/lib/store/model";

const instances = new Map<string, Chat<UIMessage>>();

export const getChatInstance = (chatId: string): Chat<UIMessage> => {
  const existing = instances.get(chatId);
  if (existing) return existing;

  const messages = useChatStore.getState().getMessages(chatId);
  const model = useModelStore.getState().model;

  const chat = new Chat({
    id: chatId,
    transport: new DefaultChatTransport({
      body: () => ({ model }),
    }),
    messages: messages.length > 0 ? messages : undefined,
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
