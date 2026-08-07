"use client";

import { Thread } from "@intentface/chat/thread";

const LINES = [
  "Thread owns the scroll container and nothing else.",
  "It tracks whether you are at the bottom, follows new content while you are, and releases the moment you scroll away.",
  "Viewport is the scrolling element. Content is the column inside it.",
  "Neither imposes width, spacing, or colour — that is all yours.",
  "Scroll this box to see the follow behaviour release.",
  "Everything below is plain text for now; messages come next.",
];

// Stage 1 — just the scroll container, filled with plain rows.
export const ThreadStage = () => (
  <div className="h-[280px] w-full max-w-xl overflow-hidden rounded-xl border border-[#f0f0f0] bg-white dark:border-[#262626] dark:bg-[#111111]">
    <Thread.Root className="relative flex h-full w-full overflow-hidden">
      <Thread.Viewport className="h-full w-full overflow-x-hidden overflow-y-auto outline-none [overflow-anchor:auto]">
        <Thread.Content className="mx-auto flex w-full flex-col gap-4 p-4">
          {LINES.map((line) => (
            <p key={line} className="text-sm leading-[1.7] text-[#1a1a1a] dark:text-[#fcfcfc]">
              {line}
            </p>
          ))}
        </Thread.Content>
      </Thread.Viewport>
    </Thread.Root>
  </div>
);
