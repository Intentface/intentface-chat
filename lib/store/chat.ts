import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { AppUIMessage } from "@/lib/ai/types";

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
  getMessages: (id: string) => AppUIMessage[];
  setMessages: (id: string, messages: AppUIMessage[]) => void;
};

const getStoredMessages = (chatId: string): AppUIMessage[] => {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(`${MESSAGE_KEY_PREFIX}${chatId}`);
    if (!raw) return [];
    return JSON.parse(raw) as AppUIMessage[];
  } catch {
    return [];
  }
};

const setStoredMessages = (chatId: string, messages: AppUIMessage[]): void => {
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
        const existing = get().chats;
        if (existing.some((c) => c.id === id)) return;
        const now = Date.now();
        set({
          chats: [{ id, title, createdAt: now, updatedAt: now }, ...existing],
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
    {
      name: "chat-store",
      merge: (persisted, current) => {
        const state = { ...current, ...(persisted as Partial<ChatStore>) };
        // Deduplicate chats that were persisted with duplicate IDs
        const seen = new Set<string>();
        state.chats = state.chats.filter((c) => {
          if (seen.has(c.id)) return false;
          seen.add(c.id);
          return true;
        });
        return state;
      },
    },
  ),
);
