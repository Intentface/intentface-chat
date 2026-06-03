# Chat Persistence

How chat data is persisted in this project (localStorage-based) and what changes when porting the same architecture to a database backend.

This is a self-contained reference — all relevant source files are inlined.

## TL;DR

- **Two storage buckets**, both in `localStorage`:
  - Chat metadata (id, title, timestamps) — Zustand `persist` slice under key `chat-store`.
  - Per-chat messages — raw `localStorage.setItem('chat-messages:<chatId>', JSON.stringify(...))`. Not in the Zustand slice.
- **One write trigger**: the AI SDK `Chat`'s `onFinish` callback. No per-token writes, no per-message writes — the full message array is serialised on every assistant-turn completion.
- **Hydration is a client-only effect**. SSR renders empty; a `useEffect` after mount reads `localStorage` and seeds the AI SDK's message state.
- **No "active chat" field** — the URL is the source of truth (`/chat/[chatId]`).
- For a **database backend**, the architecture survives largely intact. The four points to touch are: the `onFinish` write, the hydration effect, the chat-list source (sidebar), and ID/ordering semantics.

## Architecture diagram

```
                    ┌───────────────────────────────────────────┐
                    │  Zustand store (chat-store)               │
                    │  - chats: ChatMetadata[]   ◄── persist    │
                    │  - getMessages(id)         ──► localStorage
                    │  - setMessages(id, msgs)   ──► localStorage
                    └───────────────────────────────────────────┘
                              ▲                        ▲
                              │ writes metadata        │ writes messages
                              │                        │
   ┌──────────────────────────┴────────────────────────┴───────────┐
   │  Chat instance (AI SDK @ai-sdk/react)                          │
   │  - one Chat<UIMessage> per chatId, cached in a Map             │
   │  - onFinish: persist metadata.updatedAt + full message array   │
   └────────────────────────────────────────────────────────────────┘
                              ▲
                              │ useChat({ chat })
                              │
                    ┌─────────┴──────────┐
                    │  useChatInstance() │  (hook in component tree)
                    │  - hydrates from   │
                    │    localStorage    │
                    │    after mount     │
                    └────────────────────┘
```

## Data shapes

```ts
// Metadata — one row per chat in the sidebar.
type ChatMetadata = {
  id: string;        // client-generated UUID (crypto.randomUUID)
  title: string;     // first 50 chars of the first user message
  createdAt: number; // Date.now() ms
  updatedAt: number; // bumped on every onFinish
};

// Message — from the `ai` package, parameterised with project-specific
// custom data parts (here, a "chip" data part for inline UI chips).
type AppUIMessage = UIMessage<never, { chip: ChipData[] }>;
```

`UIMessage` (AI SDK) is `{ id, role, parts: UIPart[] }` where `parts` is an array of typed segments: `text`, `reasoning`, `tool-<name>` (with input/output states), `source-url`, `file`, `data-<name>` (custom). Messages are stored as plain JSON.

## Storage layout

| Storage | Key | Value |
|--|--|--|
| `localStorage` | `chat-store` | Zustand persist blob — `{ state: { chats: ChatMetadata[] }, version: 0 }` |
| `localStorage` | `chat-messages:<chatId>` | `JSON.stringify(AppUIMessage[])` — one key per chat |

Splitting metadata and messages is deliberate: the persisted Zustand slice stays small (just the sidebar list), so the `persist` middleware doesn't have to serialise every message on every chat update. Messages are written only when a turn finishes.

## The store — `lib/store/chat.ts`

```ts
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
        if (existing.some((c) => c.id === id)) return; // idempotent
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
        // Defensive: dedupe by id in case two tabs/migrations produced duplicates.
        const state = { ...current, ...(persisted as Partial<ChatStore>) };
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
```

Things worth noting:

- `createChat` is **idempotent** by id — submitting the first message twice (StrictMode double-effects, hydration races) is safe.
- `getMessages` / `setMessages` go straight to `localStorage`; they are not Zustand state, so subscribing to the store does not trigger re-renders when messages change. (Re-renders come from the AI SDK's own state.)
- The `merge` function dedupes on rehydrate — a guardrail because earlier bugs in the app produced duplicate ids.
- All `localStorage` access is guarded with `typeof window === "undefined"` so Next.js SSR doesn't blow up.

## The chat instance — `lib/chat-instance.ts`

```ts
import { Chat } from "@ai-sdk/react";
import {
  DefaultChatTransport,
  lastAssistantMessageIsCompleteWithToolCalls,
} from "ai";
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
      if (exists) store.updateChatTimestamp(chatId);
      store.setMessages(chatId, messages);
    },
  });

  instances.set(chatId, chat);
  return chat;
};

export const deleteChatInstance = (chatId: string): void => {
  instances.delete(chatId);
};
```

This is the **only place** in the codebase that writes messages. A few things to internalise:

- One `Chat` per `chatId`, cached in a module-level `Map`. Navigating away and back reuses the instance — in-flight streams survive.
- `onFinish` fires after the assistant turn is fully settled (including any auto-continuation triggered by `sendAutomaticallyWhen: lastAssistantMessageIsCompleteWithToolCalls`).
- `isAbort` and `isError` short-circuit the write — a half-streamed assistant message is **not** persisted. (The user's prompt that started it is also not persisted, since persistence is keyed on `onFinish`.)
- The whole `messages` array is rewritten every time. That's fine for `localStorage` (a few KB of JSON), wasteful for the network.

## Hydration — `hooks/use-chat-instance.ts`

```ts
"use client";

import { useChat } from "@ai-sdk/react";
import { useEffect, useMemo } from "react";
import type { AppUIMessage } from "@/lib/ai/types";
import { getChatInstance } from "@/lib/chat-instance";
import { useChatStore } from "@/lib/store/chat";

export const useChatInstance = (chatId: string) => {
  const chat = useMemo(() => getChatInstance(chatId), [chatId]);
  const helpers = useChat<AppUIMessage>({ chat });

  // Load persisted messages after mount to avoid hydration mismatch
  // (localStorage is unavailable during SSR, so both server and client
  // start with empty messages, then hydrate from storage here)
  const { setMessages } = helpers;
  useEffect(() => {
    const stored = useChatStore.getState().getMessages(chatId);
    if (stored.length > 0) setMessages(stored);
  }, [chatId, setMessages]);

  return helpers;
};
```

Pattern: **SSR renders empty, client rehydrates after mount.** The server obviously can't read `localStorage`, so the first paint is a blank chat. After mount, the effect reads from storage and calls `setMessages()` on the AI SDK helpers, which triggers a re-render with the restored messages. There is a brief flash of empty state on first paint of an existing chat; this is the price of localStorage-only.

## Routing & active chat

- `app/(chat)/page.tsx` (the homepage) generates a fresh UUID with `crypto.randomUUID()` and renders an empty chat surface keyed to that id.
- `app/(chat)/chat/[chatId]/page.tsx` renders the chat surface keyed to the URL param.
- When the user sends the first message on the homepage, `createChat(chatId, title)` runs and `router.replace('/chat/<id>')` swaps the URL in place. No remount — the same Chat instance survives because it's keyed by `chatId` in the `Map`.
- The sidebar (`components/app-sidebar.tsx`) reads `chats` from the Zustand store, sorts by `updatedAt`, and highlights the active chat by comparing `pathname` to each chat's URL. There is no `activeChatId` in the store.

## Deletion

```ts
// components/app-sidebar.tsx
const handleDelete = (chatId: string) => {
  deleteChat(chatId);          // metadata + messages from storage
  deleteChatInstance(chatId);  // in-memory Chat instance cache
  if (pathname === `/chat/${chatId}`) router.push("/");
};
```

Two things must be cleared: the persisted state (metadata + messages) and the in-memory `Chat` instance — otherwise reopening the chat would resurrect the prior conversation from the cached instance's internal state.

---

# Porting to a database

Most of the architecture survives. The changes are localised.

## What stays the same

- **The chat instance cache and `onFinish`-as-persistence-hook.** Still one `Chat` per `chatId`, still one write point.
- **The AI SDK message format on the wire.** `UIMessage` JSON is what you want to store anyway.
- **The composer / thread / message rendering layers.** They have no knowledge of how messages are stored.
- **URL-as-source-of-truth for active chat.** Don't introduce an `activeChatId` field just because you have a DB.

## What changes

### 1. The `onFinish` write becomes a network call

Replace the `localStorage` write with a server upsert. Two reasonable shapes:

**Full-array PUT (simplest, mirrors current behaviour):**

```ts
onFinish: async ({ messages, isAbort, isError }) => {
  if (isAbort || isError) return;
  await fetch(`/api/chats/${chatId}/messages`, {
    method: "PUT",
    body: JSON.stringify({ messages }),
  });
},
```

Server upserts the whole list inside a transaction. Easy to reason about; wasteful over the wire as conversations grow.

**Append-only POST (recommended once conversations get long):**

```ts
onFinish: async ({ messages, isAbort, isError }) => {
  if (isAbort || isError) return;
  // Server-side `streamText` can persist directly — see below.
  // If you still want a client-side safety net, send only the tail:
  const newMessage = messages[messages.length - 1]; // the assistant turn
  await fetch(`/api/chats/${chatId}/messages`, {
    method: "POST",
    body: JSON.stringify({ message: newMessage }),
  });
},
```

The better pattern is to persist server-side from inside the `streamText` route, using its own `onFinish` (the AI SDK route handler has one too). That removes the round-trip and survives the user closing the tab mid-stream.

### 2. Hydration becomes a server fetch

The current "empty-then-hydrate" dance exists only because `localStorage` is client-only. With a DB you can render messages on the server:

```tsx
// app/(chat)/chat/[chatId]/page.tsx
export default async function ChatPage({ params }) {
  const { chatId } = await params;
  const initialMessages = await db.message.findMany({
    where: { chatId },
    orderBy: { sequence: "asc" },
  });
  return <Chat chatId={chatId} initialMessages={initialMessages} />;
}
```

Then pass `initialMessages` into `useChat({ chat, messages: initialMessages })` on the client. Drop the `useEffect` rehydration entirely.

### 3. Sidebar becomes a server query

Replace `useChatStore((s) => s.chats)` with a server query of `chats WHERE user_id = ? ORDER BY updated_at DESC`. Keep a Zustand store for optimistic UI on create/delete/rename, but treat the server as the source of truth — reconcile on every mutation.

### 4. Schema

A minimal sketch:

```sql
CREATE TABLE chats (
  id          UUID PRIMARY KEY,           -- client-generated is fine
  user_id     UUID NOT NULL REFERENCES users(id),
  title       TEXT NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX chats_user_updated_idx ON chats (user_id, updated_at DESC);

CREATE TABLE messages (
  id         UUID PRIMARY KEY,            -- the UIMessage.id from the AI SDK
  chat_id    UUID NOT NULL REFERENCES chats(id) ON DELETE CASCADE,
  role       TEXT NOT NULL,               -- 'user' | 'assistant' | 'system'
  parts      JSONB NOT NULL,              -- the UIMessage.parts array verbatim
  sequence   BIGSERIAL NOT NULL,          -- monotonic per chat; cheap to ORDER BY
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX messages_chat_seq_idx ON messages (chat_id, sequence);
```

Notes:
- `parts` as `JSONB` lets you keep the AI SDK's wire format unchanged. No new translation layer.
- `sequence` as a per-chat `BIGSERIAL` (or just `created_at` if you're confident in timestamp resolution) gives stable ordering. **Don't rely on `id`s for ordering** — AI SDK message ids are content-derived/random.
- `ON DELETE CASCADE` keeps deletion a single `DELETE FROM chats WHERE id = ?`.

### 5. ID generation: keep it client-side

`crypto.randomUUID()` on the client remains the right call. It lets you:

- Navigate to `/chat/<id>` and call `chat.sendMessage(...)` before the chat row exists on the server. The first user message creates the chat row on the API side (`INSERT ... ON CONFLICT (id) DO NOTHING`).
- Avoid round-tripping for ids during streaming.

Just enforce uniqueness in the DB (`PRIMARY KEY`) and treat duplicates as no-ops.

### 6. Ordering across concurrent writes

`localStorage` is single-writer per tab; a DB is not. Two assistant turns can't finish at the exact same instant for the same chat (you only have one in flight), but **two tabs editing the same chat** is now possible. Decisions to make up front:

- **Conflict policy:** simplest is "last `INSERT` wins"; combined with append-only inserts and a sequence column, this is usually fine.
- **Cross-tab visibility:** add a subscription (Postgres LISTEN/NOTIFY, Supabase Realtime, Pusher, etc.) and `invalidate`/`revalidatePath` on insert, or accept eventual consistency until the user navigates.

### 7. Streaming durability

Today, if the user closes the tab mid-stream, the assistant message is lost — `onFinish` never fires on the client. With a DB you can do better: persist from the **server's** `onFinish` inside the `streamText` route handler, so the message survives client disconnects. The client's `onFinish` becomes optional (or even removed).

```ts
// app/api/chat/route.ts
const result = streamText({
  model, system, messages, tools,
  onFinish: async ({ response }) => {
    // response.messages contains the assistant turn(s) that just completed
    await db.message.createMany({
      data: response.messages.map((m) => ({
        id: m.id, chatId, role: m.role, parts: m.parts as object,
      })),
    });
    await db.chat.update({
      where: { id: chatId },
      data: { updatedAt: new Date() },
    });
  },
});
```

You'll also want to **persist the inbound user message** on the API route, before calling `streamText` — otherwise a user message that triggers a model error never gets stored.

### 8. Auth boundary

There is no user concept in this codebase — everything is per-browser. When you add a DB you need to add `user_id` to both tables and scope every query by the authenticated user. The chat instance cache, being module-level, becomes per-server-instance and per-process — fine, since it's just a memo, but don't put per-user state in it that you wouldn't want bleeding across users on the same server.

---

## Quick checklist for the port

- [ ] DB schema: `chats`, `messages` tables with `user_id`, `sequence`, `parts JSONB`.
- [ ] API route: `POST /api/chat` persists the user message before calling `streamText`; `onFinish` inside `streamText` persists the assistant turn(s).
- [ ] `getChatInstance`'s `onFinish` either no-ops (server handles it) or POSTs a tail message for redundancy.
- [ ] Page-level `loader`/Server Component fetches `initialMessages` and passes them into `useChat({ chat, messages: initialMessages })`.
- [ ] Sidebar reads chats from a server query (with optional optimistic Zustand layer).
- [ ] Delete is a `DELETE /api/chats/:id`; client also clears its `Chat` instance cache via `deleteChatInstance(chatId)`.
- [ ] Keep `crypto.randomUUID()` client-side. Treat duplicate inserts as idempotent no-ops on the server.
- [ ] Decide cross-tab strategy (none / polling / subscription) up front.
