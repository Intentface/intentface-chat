import { Chat } from "@ai-sdk/react";
import { DefaultChatTransport, lastAssistantMessageIsCompleteWithToolCalls } from "ai";
import type { AppUIMessage } from "@/lib/ai/types";
import { useChatStore } from "@/lib/store/chat";
import { useModelStore } from "@/lib/store/model";

const instances = new Map<string, Chat<AppUIMessage>>();

// An aborted assistant turn counts as "visible" if it streamed any text,
// reasoning, file, or tool part the user can see rendered.
const hasVisibleContent = (message: AppUIMessage): boolean =>
  message.parts.some((part) => {
    if (part.type === "text" || part.type === "reasoning") return part.text.trim().length > 0;
    if (part.type === "file") return true;
    return part.type.startsWith("tool-");
  });

// Resolve a stopped generation: tag the in-flight assistant turn as stopped, or
// drop it if it produced nothing visible. The aborted turn is always the LAST
// message when one exists; stopping before any assistant turn began (last is the
// user message) is a no-op. Operating on the last message keeps this idempotent,
// so it can run in both the immediate in-memory update (handleStop in chat.tsx)
// and the persisted copy (onFinish below) without diverging.
export const applyStopToMessages = (messages: AppUIMessage[]): AppUIMessage[] => {
  const lastIndex = messages.length - 1;
  if (lastIndex < 0) return messages;

  const last = messages[lastIndex];
  if (last.role !== "assistant") return messages;
  if (!hasVisibleContent(last)) return messages.slice(0, lastIndex);

  return messages.map((message, index) =>
    index === lastIndex
      ? { ...message, metadata: { ...message.metadata, stopped: true } }
      : message,
  );
};

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
      if (isError) return;
      // On abort, keep the partial turn (tagged stopped) or drop it if empty —
      // applied independently of handleStop's in-memory update so persistence
      // is correct regardless of ordering.
      const finalMessages = isAbort ? applyStopToMessages(messages) : messages;
      const store = useChatStore.getState();
      const exists = store.chats.some((c) => c.id === chatId);
      if (exists) {
        store.updateChatTimestamp(chatId);
      }
      store.setMessages(chatId, finalMessages);
    },
  });

  instances.set(chatId, chat);
  return chat;
};

export const deleteChatInstance = (chatId: string): void => {
  instances.delete(chatId);
};
