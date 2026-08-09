"use client";

import { Composer, type ComposerSubmitData } from "@intentface/chat/composer";
import { Message } from "@intentface/chat/message";
import { Thread } from "@intentface/chat/thread";
import { type ComponentProps, useState } from "react";

type ChatMessage = { id: string; role: "user" | "assistant"; text: string };

const INITIAL: ChatMessage[] = [
  { id: "1", role: "user", text: "Can you summarise this thread?" },
  {
    id: "2",
    role: "assistant",
    text: "Sure — it covers the composer's segment model, how chips serialise, and why the editor owns its own DOM.",
  },
];

// Three primitives assembled: Thread owns the scroll area and reserves space
// for its docked composer, Message renders each turn, Composer takes input.
export const Hero = () => {
  const [messages, setMessages] = useState<ChatMessage[]>(INITIAL);

  const handleSubmit = (data: ComposerSubmitData) => {
    if (data.kind !== "message" || !data.text.trim()) return;
    setMessages((current) => [
      ...current,
      { id: `${current.length}`, role: "user", text: data.text },
    ]);
  };

  return (
    <div className="h-[360px] w-full max-w-xl overflow-hidden rounded-xl border border-[#f0f0f0] bg-white dark:border-[#262626] dark:bg-[#111111]">
      <Thread.Root className="relative flex h-full w-full overflow-hidden [--thread-overlay-top-height:1rem]">
        <Thread.Viewport className="h-full w-full overflow-x-hidden overflow-y-auto outline-none [overflow-anchor:auto]">
          <div className="relative flex min-h-full w-full flex-col items-center pt-(--thread-overlay-top-height) pb-(--thread-overlay-bottom-height)">
            <Thread.Content className="mx-auto flex min-h-full w-full flex-col gap-4 px-4 [&>*:last-child]:min-h-(--thread-turn-min-height,0px)">
              {messages.map((message, index) => (
                <Message.Root
                  key={message.id}
                  role={message.role}
                  isLast={index === messages.length - 1}
                  className="group flex w-full flex-col gap-1 data-[role=user]:items-end"
                >
                  <Message.Text className="text-sm leading-[1.7] text-[#1a1a1a] group-data-[role=user]:min-h-9 group-data-[role=user]:max-w-[80%] group-data-[role=user]:rounded-2xl group-data-[role=user]:border group-data-[role=user]:border-[#f0f0f0] group-data-[role=user]:bg-white group-data-[role=user]:px-3 group-data-[role=user]:py-1.5 group-data-[role=user]:shadow-xs dark:text-[#fcfcfc] dark:group-data-[role=user]:border-[#262626] dark:group-data-[role=user]:bg-[#181818]">
                    {message.text}
                  </Message.Text>
                </Message.Root>
              ))}
            </Thread.Content>
          </div>
        </Thread.Viewport>
        <Thread.Composer className="absolute inset-x-0 bottom-0 z-2 w-full">
          <div className="flex w-full flex-col items-center px-4 pb-4">
            <Composer.Root onSubmit={handleSubmit} className="flex w-full flex-col">
              <Composer.Container className="cursor-text rounded-2xl border border-[#f0f0f0] bg-white shadow-xs transition-colors focus-within:border-[#ececec] dark:border-[#262626] dark:bg-[#181818] dark:focus-within:border-[#2d2d2d]">
                {/* The editable element is engine-owned and out of JSX reach, so
                    it is styled through the data-composer-editor variants. */}
                <Composer.Textarea className="max-h-32 min-h-8 overflow-y-auto px-4 pt-3 text-sm **:data-composer-editor:w-full **:data-composer-editor:max-w-none **:data-composer-editor:leading-[1.7] [&_[data-composer-editor]:focus]:outline-none">
                  <Composer.Placeholder
                    placeholder="Send a message…"
                    className="leading-[1.7] text-[#949494] dark:text-[#6f6f6f]"
                  />
                </Composer.Textarea>
                <Composer.Actions className="flex justify-end gap-2 p-2">
                  <Composer.Submit className="flex size-8 items-center justify-center rounded-full bg-[#1a1a1a] text-white transition-opacity disabled:opacity-40 dark:bg-[#fcfcfc] dark:text-[#111111]">
                    <SendIcon />
                  </Composer.Submit>
                </Composer.Actions>
              </Composer.Container>
            </Composer.Root>
          </div>
        </Thread.Composer>
      </Thread.Root>
    </div>
  );
};

const SendIcon = (props: ComponentProps<"svg">) => (
  <svg
    width="16"
    height="16"
    viewBox="0 0 16 16"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.5"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
    {...props}
  >
    <path d="M8 13V3m0 0L3.5 7.5M8 3l4.5 4.5" />
  </svg>
);
