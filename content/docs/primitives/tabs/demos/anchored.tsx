"use client";

import { Composer, type ComposerSubmitData } from "@intentface/chat/composer";
import { Message } from "@intentface/chat/message";
import { Tabs, useTabs } from "@intentface/chat/tabs";
import { Thread } from "@intentface/chat/thread";
import { type ComponentProps, useState } from "react";

/*
 * A chat dock in the corner of a page. The same Root, List and Viewport as the
 * document strip, with the viewport wrapped in Portal › Positioner › Popup —
 * that wrapping is the entire difference between a panel in the layout and one
 * floating over the open tab.
 *
 * What floats is a real chat, built from this package's own parts: a Thread
 * with Messages and a docked Composer. One positioner serves the whole
 * collection, anchored to whichever tab is open, so switching chats moves one
 * surface rather than tearing it down.
 *
 * The store handle is created outside React. `Tabs.Root` takes it, and so does
 * `start` below — which runs in the component that *renders* the Root and so
 * is not a descendant of it. That is what the handle is for: state a command
 * palette or a keyboard shortcut elsewhere on the page can reach. Anything
 * inside the Root reads it through `useTabs` instead.
 */
const dockStore = Tabs.createStore();

/** The draft's value. It is never in `items` — that is the whole point. */
const DRAFT = "new-chat";

type Turn = { id: string; role: "user" | "assistant"; text: string };
type Chat = { name: string; turns: Turn[] };

const REPLIES = [
  "Right — and the reason is that a function is compared by identity, so a fresh one each render reads as a change.",
  "In this case, nothing: the parent only re-renders when its own state moves, and none of it does here.",
  "It depends what is downstream of it. A memo-wrapped child cares; a plain one doesn't.",
];

// Different lengths on purpose: switching tabs has to visibly change the
// panel, since that is what the dock is here to demonstrate.
const SEEDED: Record<string, Chat> = {
  "chat-1": {
    name: "Notes",
    turns: [
      { id: "1", role: "user", text: "What's the difference between useMemo and useCallback?" },
      {
        id: "2",
        role: "assistant",
        text: "useMemo caches a computed value; useCallback caches a function reference. useCallback(fn, deps) is just useMemo(() => fn, deps).",
      },
      { id: "3", role: "user", text: "So when do I actually need useCallback?" },
      { id: "4", role: "assistant", text: REPLIES[2] as string },
    ],
  },
  "chat-2": {
    name: "Follow-up",
    turns: [
      { id: "1", role: "user", text: "Does the parent re-render when I pass a new callback?" },
      { id: "2", role: "assistant", text: REPLIES[1] as string },
    ],
  },
  "chat-3": {
    name: "Summary",
    turns: [
      { id: "1", role: "user", text: "Summarise the thread so far." },
      {
        id: "2",
        role: "assistant",
        text: "Cache values with useMemo, cache functions with useCallback, and reach for either only when something downstream is memoised.",
      },
      { id: "3", role: "user", text: "Why does identity matter for the function case?" },
      { id: "4", role: "assistant", text: REPLIES[0] as string },
      { id: "5", role: "user", text: "Got it." },
      { id: "6", role: "assistant", text: "That's the whole of it." },
    ],
  },
};

let created = 0;

export const Anchored = () => {
  const [chats, setChats] = useState(SEEDED);
  // The frame stands in for the window. Portaling into it makes it the
  // collision boundary — the surface shifts and sizes against the demo rather
  // than the browser viewport. A real dock leaves `container` alone.
  const [frame, setFrame] = useState<HTMLDivElement | null>(null);

  const title = (id: string) => (id === DRAFT ? "New chat" : (chats[id]?.name ?? id));

  const reply = (id: string, text: string) =>
    setChats((current) => {
      const chat = current[id];
      if (!chat) return current;
      const next = chat.turns.length;
      return {
        ...current,
        [id]: {
          ...chat,
          turns: [
            ...chat.turns,
            { id: `${next}-u`, role: "user", text },
            { id: `${next}-a`, role: "assistant", text: REPLIES[next % REPLIES.length] as string },
          ],
        },
      };
    });

  /** A chat the visitor started is titled by what they typed. */
  const start = (text: string) => {
    created += 1;
    const id = `chat-new-${created}`;
    setChats((current) => ({
      ...current,
      [id]: {
        name: text.length > 34 ? `${text.slice(0, 34)}…` : text,
        turns: [
          { id: "1", role: "user", text },
          { id: "2", role: "assistant", text: REPLIES[0] as string },
        ],
      },
    }));
    // Adds the tab, selects it, and drops the draft in the same move — nothing
    // here has to clean anything up.
    dockStore.getSnapshot().open(id);
  };

  return (
    <div
      ref={setFrame}
      className="relative flex h-[36rem] w-full flex-col overflow-hidden rounded-xl border border-[#f0f0f0] bg-white dark:border-[#262626] dark:bg-[#181818]"
    >
      {/* The page the dock sits over. */}
      <article className="min-h-0 flex-1 overflow-hidden px-10 py-8">
        <h1 className="mb-6 font-semibold text-[#1a1a1a] text-2xl tracking-tight dark:text-[#fcfcfc]">
          Getting started
        </h1>
        <p className="mb-4 max-w-2xl text-[#686868] text-sm leading-[1.7] dark:text-[#9b9b9b]">
          A chat dock is something you work <em>behind</em>: non-modal throughout, with no backdrop,
          no scroll lock, no focus trap, and no dismissal on outside press. Open a chat below, then
          keep reading — the page stays yours.
        </p>
        <p className="max-w-2xl text-[#686868] text-sm leading-[1.7] dark:text-[#9b9b9b]">
          The Agent button is a trigger written outside the list. Its value is never in the
          collection, so it anchors a draft to itself without creating a tab — send something and a
          tab appears, titled by what you typed.
        </p>
      </article>

      {/* A row in the layout rather than a fixed overlay, so it sits beside the
          content instead of on top of it. */}
      <div className="flex shrink-0 items-center justify-end gap-0.5 overflow-x-auto px-2 pb-2">
        <Tabs.Root
          store={dockStore}
          defaultItems={Object.keys(SEEDED)}
          className="flex items-center"
        >
          <Tabs.List aria-label="Chats" className="flex items-center gap-0.5">
            {(id) => (
              <Tabs.Trigger value={id} aria-label={title(id)} className={dockTabClass}>
                <Tabs.Icon className="[&>svg]:size-4 [&>svg]:shrink-0 [&>svg]:opacity-60">
                  <ChatIcon />
                </Tabs.Icon>
                <span className="min-w-0 truncate">{title(id)}</span>
                <Tabs.Action
                  className={[
                    "absolute inset-y-0 right-0 flex items-center bg-inherit pr-1 pl-3",
                    "[mask-image:linear-gradient(to_right,transparent,#000_0.5rem)]",
                    "opacity-0 transition-opacity group-hover/tab:opacity-100 group-data-[selected]/tab:opacity-100",
                  ].join(" ")}
                >
                  <Tabs.Close
                    aria-label={`Close ${title(id)}`}
                    className="grid size-5 shrink-0 cursor-pointer select-none place-items-center rounded text-[#686868] transition-colors hover:bg-[#e4e4e4] hover:text-[#1a1a1a] dark:text-[#9b9b9b] dark:hover:bg-[#333333] dark:hover:text-[#fcfcfc]"
                  >
                    <CloseIcon />
                  </Tabs.Close>
                </Tabs.Action>
              </Tabs.Trigger>
            )}
          </Tabs.List>

          {/* Outside the list: it takes an explicit value and keeps its own tab
              stop rather than joining the roving focus — but it carries the same
              disclosure ARIA a tab does. */}
          <Tabs.Trigger value={DRAFT} className={`${dockTabClass} ml-1 max-w-none`}>
            <Tabs.Icon className="[&>svg]:size-4 [&>svg]:shrink-0 [&>svg]:opacity-60">
              <AgentIcon />
            </Tabs.Icon>
            Agent
          </Tabs.Trigger>

          {frame && (
            <Tabs.Portal container={frame}>
              <Tabs.Positioner
                side="top"
                align="end"
                sideOffset={6}
                className="z-40 transition-[top,left] duration-200 ease-out motion-reduce:transition-none"
              >
                {/* Sized against the room the positioner measured, rather than
                    guessing and overflowing the frame. */}
                <Tabs.Popup
                  className={[
                    "flex h-[min(30rem,var(--anchor-available-height,30rem))] w-[min(24rem,var(--anchor-available-width,24rem))] flex-col overflow-hidden",
                    // The ring is baked into the shadow — no border on top.
                    "rounded-xl bg-white smooth-shadow-ring-lg dark:bg-[#181818]",
                    // Anchored top/end, so it grows from its bottom-right corner — the tab.
                    "origin-bottom-right transition-[opacity,scale,translate] duration-150 ease-out",
                    "data-[starting-style]:translate-y-1 data-[ending-style]:translate-y-1",
                    "data-[starting-style]:scale-[0.98] data-[ending-style]:scale-[0.98]",
                    "data-[starting-style]:opacity-0 data-[ending-style]:opacity-0",
                    "motion-reduce:transition-none",
                  ].join(" ")}
                >
                  <DockHeader title={title} />
                  <Tabs.Viewport className="relative min-h-0 flex-1">
                    {(id) =>
                      id === DRAFT ? (
                        <NewChat onStart={start} />
                      ) : (
                        // Keyed so a different chat gets a fresh scroll position
                        // and an empty composer, rather than inheriting the last one's.
                        <ChatThread key={id} chat={chats[id]} onSend={(text) => reply(id, text)} />
                      )
                    }
                  </Tabs.Viewport>
                </Tabs.Popup>
              </Tabs.Positioner>
            </Tabs.Portal>
          )}
        </Tabs.Root>
      </div>
    </div>
  );
};

/**
 * One header for the collection, not one per panel — including over the draft,
 * which otherwise has no way to dismiss itself short of hitting Agent again.
 */
const DockHeader = ({ title }: { title: (id: string) => string }) => {
  const open = useTabs((tabs) => tabs.value);
  const select = useTabs((tabs) => tabs.select);
  const close = useTabs((tabs) => tabs.close);
  const isDraft = open === DRAFT;

  return (
    <header className="flex h-10 shrink-0 items-center gap-1 border-[#f0f0f0] border-b px-2.5 dark:border-[#262626]">
      <span className="min-w-0 flex-1 truncate font-medium text-[#1a1a1a] text-sm dark:text-[#fcfcfc]">
        {open === null || isDraft ? null : title(open)}
      </span>
      <button
        type="button"
        aria-label="Minimise"
        onClick={() => select(null)}
        className={iconButtonClass}
      >
        <MinusIcon />
      </button>
      <button
        type="button"
        aria-label={isDraft ? "Discard draft" : "Close chat"}
        onClick={() => {
          // A draft is not in `items`, so there is nothing to close —
          // deselecting is what discards it.
          if (open === null || isDraft) return select(null);
          close(open);
        }}
        className={iconButtonClass}
      >
        <CloseIcon />
      </button>
    </header>
  );
};

// Thread measures its docked composer and publishes the reserve as
// --thread-overlay-bottom-height, so the last message never hides behind it.
const ChatThread = ({
  chat,
  onSend,
}: {
  chat: Chat | undefined;
  onSend: (text: string) => void;
}) => {
  if (!chat) return null;

  return (
    <Thread.Root className="relative flex h-full w-full overflow-hidden [--thread-overlay-top-height:0.75rem]">
      <Thread.Viewport className="h-full w-full overflow-x-hidden overflow-y-auto outline-none [overflow-anchor:auto]">
        <div className="relative flex min-h-full w-full flex-col pt-(--thread-overlay-top-height) pb-(--thread-overlay-bottom-height)">
          <Thread.Content className="flex min-h-full w-full flex-col gap-3 px-3 [&>*:last-child]:min-h-(--thread-turn-min-height,0px)">
            {chat.turns.map((turn, index) => (
              <Message.Root
                key={turn.id}
                role={turn.role}
                isLast={index === chat.turns.length - 1}
                className="group flex w-full flex-col data-[role=user]:items-end"
              >
                <Message.Text className="text-[#1a1a1a] text-sm leading-[1.7] group-data-[role=user]:max-w-[85%] group-data-[role=user]:rounded-2xl group-data-[role=user]:rounded-br-md group-data-[role=user]:bg-[#f4f4f4] group-data-[role=user]:px-3 group-data-[role=user]:py-1.5 dark:text-[#fcfcfc] dark:group-data-[role=user]:bg-[#262626]">
                  {turn.text}
                </Message.Text>
              </Message.Root>
            ))}
          </Thread.Content>
        </div>
      </Thread.Viewport>
      <Thread.Composer className="absolute inset-x-0 bottom-0 z-2 w-full p-2 pt-0">
        <DockComposer placeholder="Reply…" onSubmit={onSend} />
      </Thread.Composer>
    </Thread.Root>
  );
};

/**
 * A chat that does not exist yet. The one place real words survive: a draft
 * that looks like an empty chat gives no hint that sending it creates a tab.
 */
const NewChat = ({ onStart }: { onStart: (text: string) => void }) => (
  <div className="flex h-full flex-col">
    <div className="flex flex-1 flex-col items-center justify-center gap-1.5 px-6 text-center">
      <AgentIcon className="size-5 text-[#949494] dark:text-[#6f6f6f]" />
      <p className="font-medium text-[#1a1a1a] text-sm dark:text-[#fcfcfc]">Ask the agent</p>
      <p className="text-[#686868] text-sm leading-[1.7] dark:text-[#9b9b9b]">
        This is a draft — it becomes a tab once you send something.
      </p>
    </div>
    <div className="shrink-0 p-2 pt-0">
      <DockComposer placeholder="Ask anything…" onSubmit={onStart} />
    </div>
  </div>
);

// The composer clears itself on submit, so the handler only has to act on the
// text. Every Composer.Root owns an isolated store — no setup beyond onSubmit.
const DockComposer = ({
  placeholder,
  onSubmit,
}: {
  placeholder: string;
  onSubmit: (text: string) => void;
}) => {
  const handleSubmit = (data: ComposerSubmitData) => {
    if (data.kind !== "message") return;
    const text = data.text.trim();
    if (text) onSubmit(text);
  };

  return (
    <Composer.Root onSubmit={handleSubmit} className="flex w-full flex-col">
      <Composer.Container className="cursor-text rounded-xl border border-[#f0f0f0] bg-white shadow-xs transition-colors focus-within:border-[#ececec] dark:border-[#262626] dark:bg-[#111111] dark:focus-within:border-[#2d2d2d]">
        <Composer.Textarea className="max-h-32 min-h-10 overflow-y-auto px-3 pt-2.5 text-sm **:data-composer-editor:w-full **:data-composer-editor:max-w-none **:data-composer-editor:leading-[1.7] [&_[data-composer-editor]:focus]:outline-none">
          <Composer.Placeholder
            placeholder={placeholder}
            className="leading-[1.7] text-[#949494] dark:text-[#6f6f6f]"
          />
        </Composer.Textarea>
        <Composer.Actions className="flex justify-end p-1.5 pt-0">
          <Composer.Submit
            aria-label="Send"
            className="flex size-7 items-center justify-center rounded-full bg-[#1a1a1a] text-white transition-opacity disabled:opacity-30 dark:bg-[#fcfcfc] dark:text-[#111111]"
          >
            <ArrowUpIcon />
          </Composer.Submit>
        </Composer.Actions>
      </Composer.Container>
    </Composer.Root>
  );
};

const dockTabClass = [
  "group/tab relative flex h-7 max-w-40 shrink-0 cursor-pointer select-none items-center gap-1.5 overflow-hidden",
  "rounded-md px-2.5 text-[#686868] text-sm transition-colors dark:text-[#9b9b9b]",
  "hover:bg-[#f4f4f4] dark:hover:bg-[#232323]",
  "focus-visible:-outline-offset-2 focus-visible:outline-2 focus-visible:outline-[#1a1a1a] dark:focus-visible:outline-[#fcfcfc]",
  "data-[selected]:bg-[#ececec] data-[selected]:text-[#1a1a1a] dark:data-[selected]:bg-[#2d2d2d] dark:data-[selected]:text-[#fcfcfc]",
].join(" ");

const iconButtonClass =
  "grid size-6 shrink-0 cursor-pointer select-none place-items-center rounded-md text-[#949494] transition-colors hover:bg-[#f4f4f4] hover:text-[#1a1a1a] focus-visible:-outline-offset-2 focus-visible:outline-2 focus-visible:outline-[#1a1a1a] dark:text-[#6f6f6f] dark:hover:bg-[#232323] dark:hover:text-[#fcfcfc] dark:focus-visible:outline-[#fcfcfc]";

const ChatIcon = (props: ComponentProps<"svg">) => (
  <svg
    viewBox="0 0 16 16"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.3"
    aria-hidden="true"
    {...props}
  >
    <path
      d="M13.5 8.5a4.5 4.5 0 0 1-4.5 4.5H6l-3 2v-2.6A4.5 4.5 0 0 1 6 4h3a4.5 4.5 0 0 1 4.5 4.5Z"
      strokeLinejoin="round"
    />
  </svg>
);

const AgentIcon = (props: ComponentProps<"svg">) => (
  <svg
    viewBox="0 0 16 16"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.3"
    aria-hidden="true"
    {...props}
  >
    <rect x="3" y="5" width="10" height="8" rx="2.5" strokeLinejoin="round" />
    <path d="M8 2.5V5" strokeLinecap="round" />
    <path d="M6.5 9h.01M9.5 9h.01" strokeLinecap="round" strokeWidth="1.8" />
  </svg>
);

const ArrowUpIcon = (props: ComponentProps<"svg">) => (
  <svg
    viewBox="0 0 16 16"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.5"
    strokeLinecap="round"
    strokeLinejoin="round"
    className="size-4"
    aria-hidden="true"
    {...props}
  >
    <path d="M8 13V3m0 0L3.5 7.5M8 3l4.5 4.5" />
  </svg>
);

const MinusIcon = (props: ComponentProps<"svg">) => (
  <svg
    viewBox="0 0 16 16"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.5"
    strokeLinecap="round"
    className="size-3.5"
    aria-hidden="true"
    {...props}
  >
    <path d="M3.5 8h9" />
  </svg>
);

const CloseIcon = (props: ComponentProps<"svg">) => (
  <svg
    viewBox="0 0 16 16"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.5"
    strokeLinecap="round"
    className="size-3.5"
    aria-hidden="true"
    {...props}
  >
    <path d="m4.5 4.5 7 7M11.5 4.5l-7 7" />
  </svg>
);
