"use client";

import { Tabs, useTabs } from "@intentface/chat/tabs";
import { MessageSquare, Minus, Sparkles, X } from "@keyline-icons/react";
import { useRef, useState } from "react";
import { ChatThread, NewChat, REPLIES, SEEDED, type Turn } from "./chat";

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
 *
 * A reply takes a moment to arrive. Escape anywhere in the chat stops it first,
 * and only the next Escape closes the dock.
 */
const dockStore = Tabs.createStore();

/** The draft's value. It is never in `items` — that is the whole point. */
const DRAFT = "new-chat";

let created = 0;

export const Anchored = () => {
  const [chats, setChats] = useState(SEEDED);
  // The frame stands in for the window. Portaling into it makes it the
  // collision boundary — the surface shifts and sizes against the demo rather
  // than the browser viewport. A real dock leaves `container` alone.
  const [frame, setFrame] = useState<HTMLDivElement | null>(null);

  const title = (id: string) => (id === DRAFT ? "New chat" : (chats[id]?.name ?? id));

  // Each chat's reply on its way, standing in for a model streaming one.
  const [generating, setGenerating] = useState<ReadonlySet<string>>(new Set());
  const pendingReplies = useRef(new Map<string, ReturnType<typeof setTimeout>>());

  const append = (id: string, turn: Turn) =>
    setChats((current) => {
      const chat = current[id];
      if (!chat) return current;
      return { ...current, [id]: { ...chat, turns: [...chat.turns, turn] } };
    });

  const settle = (id: string) => {
    pendingReplies.current.delete(id);
    setGenerating((current) => {
      const remaining = new Set(current);
      remaining.delete(id);
      return remaining;
    });
  };

  const reply = (id: string, text: string) => {
    const next = chats[id]?.turns.length ?? 0;
    append(id, { id: `${next}-u`, role: "user", text });
    clearTimeout(pendingReplies.current.get(id));
    setGenerating((current) => new Set(current).add(id));
    pendingReplies.current.set(
      id,
      setTimeout(() => {
        append(id, {
          id: `${next}-a`,
          role: "assistant",
          text: REPLIES[next % REPLIES.length] as string,
        });
        settle(id);
      }, 2500),
    );
  };

  const stop = (id: string) => {
    clearTimeout(pendingReplies.current.get(id));
    settle(id);
  };

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
      className="relative flex h-[36rem] w-full flex-col overflow-hidden rounded-xl bg-[#f5f5f6] shadow-[0_0_0_1px_rgb(0_0_0/0.075),0_1px_2px_rgb(0_0_0/0.06),0_4px_8px_-2px_rgb(0_0_0/0.05)] dark:bg-[#131315] dark:shadow-[0_0_0_1px_rgb(0_0_0/0.16),0_1px_2px_rgb(0_0_0/0.1)] dark:after:pointer-events-none dark:after:absolute dark:after:inset-0 dark:after:z-50 dark:after:rounded-[inherit] dark:after:shadow-[inset_0_1px_0_rgb(255_255_255/0.05),inset_0_0_0_1px_rgb(255_255_255/0.06)]"
    >
      {/* The page the dock sits over. */}
      <article className="mx-2 mt-2 min-h-0 flex-1 overflow-hidden rounded-lg bg-white px-10 py-8 shadow-[0_0_0_1px_rgb(0_0_0/0.075),0_1px_2px_rgb(0_0_0/0.06),0_4px_8px_-2px_rgb(0_0_0/0.05)] dark:bg-zinc-900 dark:shadow-[inset_0_1px_0_rgb(255_255_255/0.05),inset_0_0_0_1px_rgb(255_255_255/0.06),0_0_0_1px_rgb(0_0_0/0.16),0_1px_2px_rgb(0_0_0/0.1)]">
        <h1 className="mb-5 font-semibold text-base text-zinc-900 tracking-tight dark:text-zinc-100">
          Getting started
        </h1>
        <p className="mb-4 max-w-2xl text-sm text-zinc-700 leading-[1.7] dark:text-zinc-300">
          A chat dock is something you work <em>behind</em>: non-modal throughout, with no backdrop,
          no scroll lock, no focus trap, and no dismissal on outside press. Open a chat below, then
          keep reading — the page stays yours.
        </p>
        <p className="max-w-2xl text-sm text-zinc-700 leading-[1.7] dark:text-zinc-300">
          The Agent button is a trigger written outside the list. Its value is never in the
          collection, so it anchors a draft to itself without creating a tab — send something and a
          tab appears, titled by what you typed.
        </p>
      </article>

      {/* A row in the layout rather than a fixed overlay, so it sits beside the
          content instead of on top of it. */}
      <div className="flex shrink-0 items-center justify-end gap-0.5 overflow-x-auto p-2">
        <Tabs.Root
          store={dockStore}
          defaultItems={Object.keys(SEEDED)}
          className="flex items-center"
        >
          <Tabs.List aria-label="Chats" className="flex items-center gap-0.5">
            {(id) => (
              <Tabs.Trigger value={id} aria-label={title(id)} className={dockTabClass}>
                <Tabs.Icon className="text-zinc-500 dark:text-zinc-400 [&>svg]:size-[15px] [&>svg]:shrink-0">
                  <MessageSquare className="size-[15px]" />
                </Tabs.Icon>
                <span className="min-w-0 truncate">{title(id)}</span>
                <Tabs.Action
                  className={[
                    // Inset 1px with a matching corner, so the cover never paints over the
                    // tab's ring and top highlight; it inherits the face's gradient too,
                    // not just its colour, so it doesn't read as a flat block.
                    "absolute inset-y-px right-px flex items-center rounded-r-[5px] bg-inherit [background-image:inherit] pr-1 pl-3",
                    "[mask-image:linear-gradient(to_right,transparent,#000_0.5rem)]",
                    "opacity-0 transition-opacity group-hover/tab:opacity-100 group-data-[selected]/tab:opacity-100",
                  ].join(" ")}
                >
                  <Tabs.Close
                    aria-label={`Close ${title(id)}`}
                    className="grid size-5 shrink-0 cursor-pointer select-none place-items-center rounded-full text-zinc-400 transition-colors hover:bg-zinc-950/5 hover:text-zinc-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0169cc]/60 dark:text-zinc-500 dark:hover:bg-white/8 dark:hover:text-zinc-100"
                  >
                    <X className="size-3.5" />
                  </Tabs.Close>
                </Tabs.Action>
              </Tabs.Trigger>
            )}
          </Tabs.List>

          {/* Outside the list: it takes an explicit value and keeps its own tab
              stop rather than joining the roving focus — but it carries the same
              disclosure ARIA a tab does. */}
          <Tabs.Trigger value={DRAFT} className={`${dockTabClass} ml-1 max-w-none`}>
            <Tabs.Icon className="text-zinc-500 dark:text-zinc-400 [&>svg]:size-[15px] [&>svg]:shrink-0">
              <Sparkles className="size-[15px]" />
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
                    "rounded-xl bg-white p-1 shadow-[0_0_0_1px_rgb(0_0_0/0.075),0_1px_2px_rgb(0_0_0/0.06),0_12px_32px_-8px_rgb(0_0_0/0.16)]",
                    // A chat window, so it takes the panel colour; its bubble and
                    // composer lift off it, as in a full-size chat.
                    "dark:bg-zinc-900 dark:shadow-[inset_0_1px_0_rgb(255_255_255/0.06),inset_0_0_0_1px_rgb(255_255_255/0.07),0_0_0_1px_rgb(0_0_0/0.16),0_12px_32px_-8px_rgb(0_0_0/0.4)]",
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
                        <ChatThread
                          key={id}
                          chat={chats[id]}
                          onSend={(text) => reply(id, text)}
                          generating={generating.has(id)}
                          onStop={() => stop(id)}
                        />
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
    <header className="flex h-10 shrink-0 items-center gap-0.5 pr-1 pl-2.5">
      <span className="min-w-0 flex-1 truncate font-medium text-[13px] text-zinc-900 dark:text-zinc-100">
        {open === null || isDraft ? null : title(open)}
      </span>
      <button
        type="button"
        aria-label="Minimise"
        onClick={() => select(null)}
        className={iconButtonClass}
      >
        <Minus className="size-[15px]" />
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
        <X className="size-[15px]" />
      </button>
    </header>
  );
};

const dockTabClass = [
  "group/tab relative flex h-[30px] max-w-40 shrink-0 cursor-pointer select-none items-center gap-1.5 overflow-hidden",
  "rounded-md px-2.5 font-medium text-[13px] text-zinc-700 transition-colors dark:text-zinc-300",
  // Opaque rather than a translucent wash: the action inherits this colour, and
  // a wash painted twice would show as a darker band behind the ×.
  "hover:bg-[#e9e9ea] dark:hover:bg-[#262628]",
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0169cc]/60",
  "data-[selected]:bg-white data-[selected]:bg-linear-to-b data-[selected]:from-white data-[selected]:to-[#fdfdfd] data-[selected]:text-zinc-900",
  "data-[selected]:shadow-[inset_0_1px_0_#fff,0_0_0_1px_rgb(0_0_0/0.075),0_1px_2px_rgb(0_0_0/0.07),0_2px_6px_-2px_rgb(0_0_0/0.05)]",
  "dark:data-[selected]:bg-[#2d2d30] dark:data-[selected]:from-[#313134] dark:data-[selected]:to-[#2a2a2d] dark:data-[selected]:text-zinc-100",
  "dark:data-[selected]:shadow-[0_0_0_1px_rgb(0_0_0/0.16),0_1px_2px_rgb(0_0_0/0.1)]",
  // The inset ring and top highlight go on an overlay above the content, so the
  // close button's fading cover can't paint over them.
  "dark:data-[selected]:after:pointer-events-none dark:data-[selected]:after:absolute dark:data-[selected]:after:inset-0 dark:data-[selected]:after:rounded-[inherit] dark:data-[selected]:after:shadow-[inset_0_1px_0_rgb(255_255_255/0.1),inset_0_0_0_1px_rgb(255_255_255/0.05)]",
].join(" ");

const iconButtonClass =
  "grid size-7 shrink-0 cursor-pointer select-none place-items-center rounded-full text-zinc-400 transition-colors hover:bg-zinc-950/5 hover:text-zinc-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0169cc]/60 dark:text-zinc-500 dark:hover:bg-white/8 dark:hover:text-zinc-100";
