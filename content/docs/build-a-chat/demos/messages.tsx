"use client";

import { Message } from "@intentface/chat/message";
import { Thread } from "@intentface/chat/thread";

const MESSAGES = [
  { id: "1", role: "user", text: "What does Message actually render?" },
  {
    id: "2",
    role: "assistant",
    text: "A div with data-role, data-last and data-error on it, plus whatever you put inside. No bubble, no avatar, no alignment.",
  },
  { id: "3", role: "user", text: "So the bubble is mine?" },
  {
    id: "4",
    role: "assistant",
    text: "Entirely. Read data-role through a group and style the two sides differently — that's the whole mechanism.",
  },
];

// Stage 2 — the same thread, with each row now a Message that reports its role.
export const MessagesStage = () => (
  <div className="h-[280px] w-full max-w-xl overflow-hidden rounded-xl border border-[#f0f0f0] bg-white dark:border-[#262626] dark:bg-[#111111]">
    <Thread.Root className="relative flex h-full w-full overflow-hidden">
      <Thread.Viewport className="h-full w-full overflow-x-hidden overflow-y-auto outline-none [overflow-anchor:auto]">
        <Thread.Content className="mx-auto flex w-full flex-col gap-4 p-4">
          {MESSAGES.map((message, index) => (
            <Message.Root
              key={message.id}
              role={message.role}
              isLast={index === MESSAGES.length - 1}
              className="group flex w-full flex-col gap-1 data-[role=user]:items-end"
            >
              {/* data-role sits on Root, so the bubble reads it through the group. */}
              <Message.Text className="text-sm leading-[1.7] text-[#1a1a1a] group-data-[role=user]:min-h-9 group-data-[role=user]:max-w-[80%] group-data-[role=user]:rounded-2xl group-data-[role=user]:border group-data-[role=user]:border-[#f0f0f0] group-data-[role=user]:bg-white group-data-[role=user]:px-3 group-data-[role=user]:py-1.5 group-data-[role=user]:shadow-xs dark:text-[#fcfcfc] dark:group-data-[role=user]:border-[#262626] dark:group-data-[role=user]:bg-[#181818]">
                {message.text}
              </Message.Text>
            </Message.Root>
          ))}
        </Thread.Content>
      </Thread.Viewport>
    </Thread.Root>
  </div>
);
