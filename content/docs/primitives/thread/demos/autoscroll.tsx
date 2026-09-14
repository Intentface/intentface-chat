"use client";

import { Message } from "@intentface/chat/message";
import { Thread } from "@intentface/chat/thread";
import { useEffect, useRef, useState } from "react";

type Turn = { id: string; role: "user" | "assistant"; text: string };

const SEED: Turn[] = [
  { id: "1", role: "user", text: "Why does my list re-render on every keystroke?" },
  {
    id: "2",
    role: "assistant",
    text: "Because the parent holding the input state re-renders, and every child re-renders with it unless something stops the cascade.",
  },
  { id: "3", role: "user", text: "Can I just memo the list?" },
  {
    id: "4",
    role: "assistant",
    text: "You can, but only if its props keep reference identity. A fresh array or an inline callback defeats it silently.",
  },
];

const MODES = ["follow", "bottom", "jump", "off"] as const;
type Mode = (typeof MODES)[number];

const CAPTIONS: Record<Mode, string> = {
  follow: "Newest lands at the top and the view follows the stream.",
  bottom: "Newest lands at the bottom and the view follows the stream.",
  jump: "Newest lands at the top; the view does not follow.",
  off: "A plain scroll area — no landing, no follow, no reserve.",
};

const REPLY =
  "Memoisation compares props, so the comparison itself has to be cheaper than the render you are avoiding. That is usually true for a list and rarely true for a single row.";

/*
 * The four modes, on the same transcript.
 *
 * `autoScroll` decides two things at once: where a new turn lands, and whether
 * the view keeps following while text streams into it. Send a message in each
 * mode and watch the difference — and in `follow` and `jump`, notice the space
 * reserved beneath the newest turn, which is what lets it land at the top.
 *
 * Remounting on a mode change is this demo's doing, not a requirement: the key
 * forces a fresh scroll subsystem so each mode is observed from its own
 * opening position rather than wherever the last one left the scroller.
 */
export const AutoScroll = () => {
  const [mode, setMode] = useState<Mode>("follow");
  const [turns, setTurns] = useState<Turn[]>(SEED);
  const [streaming, setStreaming] = useState(false);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  const send = () => {
    timers.current.forEach(clearTimeout);
    timers.current = [];

    const stamp = Date.now();
    setTurns((current) => [
      ...current,
      { id: `${stamp}-u`, role: "user", text: "Is memoising the list enough?" },
      { id: `${stamp}-a`, role: "assistant", text: "" },
    ]);
    setStreaming(true);

    // Word by word, so following is something you can actually watch.
    const words = REPLY.split(" ");
    words.forEach((_, index) => {
      timers.current.push(
        setTimeout(() => {
          setTurns((current) =>
            current.map((turn) =>
              turn.id === `${stamp}-a`
                ? { ...turn, text: words.slice(0, index + 1).join(" ") }
                : turn,
            ),
          );
        }, index * 60),
      );
    });
    timers.current.push(setTimeout(() => setStreaming(false), words.length * 60));
  };

  return (
    <div className="flex w-full max-w-xl flex-col gap-3">
      <div className="flex flex-wrap items-center justify-center gap-1">
        {MODES.map((candidate) => (
          <button
            key={candidate}
            type="button"
            onClick={() => {
              setMode(candidate);
              setTurns(SEED);
            }}
            className={[
              "h-8 cursor-pointer rounded-full border px-3 font-mono text-xs transition-colors",
              candidate === mode
                ? "border-[#1a1a1a] bg-[#1a1a1a] text-white dark:border-[#fcfcfc] dark:bg-[#fcfcfc] dark:text-[#111111]"
                : "border-[#e4e4e4] bg-white text-[#686868] hover:bg-[#f4f4f4] dark:border-[#2d2d2d] dark:bg-[#181818] dark:text-[#9b9b9b] dark:hover:bg-[#232323]",
            ].join(" ")}
          >
            {candidate}
          </button>
        ))}
      </div>

      <div className="h-80 w-full overflow-hidden rounded-xl border border-[#f0f0f0] bg-white dark:border-[#262626] dark:bg-[#181818]">
        <Thread.Root
          key={mode}
          autoScroll={mode}
          className="relative flex h-full w-full overflow-hidden [--thread-overlay-top-height:1rem]"
        >
          <Thread.Viewport className="h-full w-full overflow-x-hidden overflow-y-auto outline-none [overflow-anchor:auto]">
            <div className="relative flex min-h-full w-full flex-col pt-(--thread-overlay-top-height) pb-4">
              {/* The reserve the primitive publishes lands on the last child. */}
              <Thread.Content className="flex min-h-full w-full flex-col gap-4 px-4 [&>*:last-child]:min-h-(--thread-turn-min-height,0px)">
                {turns.map((turn, index) => (
                  <Message.Root
                    key={turn.id}
                    role={turn.role}
                    isLast={index === turns.length - 1}
                    data-message-id={turn.id}
                    className="group flex w-full flex-col data-[role=user]:items-end"
                  >
                    <Message.Text className="max-w-[85%] text-[#1a1a1a] text-sm leading-[1.7] group-data-[role=user]:rounded-2xl group-data-[role=user]:border group-data-[role=user]:border-[#f0f0f0] group-data-[role=user]:bg-[#fafafa] group-data-[role=user]:px-3 group-data-[role=user]:py-1.5 dark:text-[#fcfcfc] dark:group-data-[role=user]:border-[#262626] dark:group-data-[role=user]:bg-[#232323]">
                      {turn.text}
                    </Message.Text>
                  </Message.Root>
                ))}
              </Thread.Content>
            </div>
          </Thread.Viewport>
        </Thread.Root>
      </div>

      <div className="flex items-center justify-between gap-3">
        <p className="text-[#686868] text-xs dark:text-[#9b9b9b]">{CAPTIONS[mode]}</p>
        <button
          type="button"
          onClick={send}
          disabled={streaming}
          className="h-8 shrink-0 cursor-pointer rounded-full border border-[#e4e4e4] bg-white px-4 font-medium text-[#1a1a1a] text-sm transition-colors hover:bg-[#f4f4f4] disabled:cursor-default disabled:opacity-40 dark:border-[#2d2d2d] dark:bg-[#181818] dark:text-[#fcfcfc] dark:hover:bg-[#232323]"
        >
          {streaming ? "Streaming…" : "Send a reply"}
        </button>
      </div>
    </div>
  );
};
