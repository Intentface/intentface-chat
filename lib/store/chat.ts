import type { UIMessage } from "ai";
import { create } from "zustand";
import { persist } from "zustand/middleware";

const MESSAGE_KEY_PREFIX = "chat-messages:";

export type ChatMetadata = {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
};

type ChatStore = {
  chats: ChatMetadata[];
  createChat: (id: string, title: string) => void;
  deleteChat: (id: string) => void;
  updateChatTimestamp: (id: string) => void;
  getMessages: (id: string) => UIMessage[];
  setMessages: (id: string, messages: UIMessage[]) => void;
};

const getStoredMessages = (chatId: string): UIMessage[] => {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(`${MESSAGE_KEY_PREFIX}${chatId}`);
    if (!raw) return [];
    return JSON.parse(raw) as UIMessage[];
  } catch {
    return [];
  }
};

const setStoredMessages = (chatId: string, messages: UIMessage[]): void => {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(
      `${MESSAGE_KEY_PREFIX}${chatId}`,
      JSON.stringify(messages),
    );
  } catch {
    // Silent fail on quota exceeded
  }
};

const deleteStoredMessages = (chatId: string): void => {
  if (typeof window === "undefined") return;
  localStorage.removeItem(`${MESSAGE_KEY_PREFIX}${chatId}`);
};

export const useChatStore = create<ChatStore>()(
  persist(
    (set, get) => ({
      chats: [],
      createChat: (id, title) => {
        const now = Date.now();
        set({
          chats: [
            { id, title, createdAt: now, updatedAt: now },
            ...get().chats,
          ],
        });
      },
      deleteChat: (id) => {
        deleteStoredMessages(id);
        set({ chats: get().chats.filter((c) => c.id !== id) });
      },
      updateChatTimestamp: (id) =>
        set({
          chats: get().chats.map((c) =>
            c.id === id ? { ...c, updatedAt: Date.now() } : c,
          ),
        }),
      getMessages: getStoredMessages,
      setMessages: setStoredMessages,
    }),
    { name: "chat-store" },
  ),
);
