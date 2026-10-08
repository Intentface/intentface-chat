"use client";

import { Message } from "@intentface/chat/message";
import { Check, Copy } from "@keyline-icons/react";
import { useState } from "react";

// Message.Root stamps data-role / data-last / data-error and imposes no layout;
// the bubble, alignment, and actions are all yours.
const MESSAGES = [
  { id: "q", role: "user", text: "How do I center a div?" },
  {
    id: "a",
    role: "assistant",
    text: "Use flexbox on the parent: display: flex, then justify-content: center and align-items: center.",
  },
];

export const Basic = () => (
  <div className="flex w-full max-w-xl flex-col gap-5">
    {MESSAGES.map((message, index) => (
      <Message.Root
        key={message.id}
        role={message.role}
        isLast={index === MESSAGES.length - 1}
        className="group flex w-full flex-col gap-1.5 data-[role=user]:items-end"
      >
        {/* data-role sits on Root, so the bubble reads it through the group. */}
        <Message.Text className="text-sm text-zinc-700 leading-6 group-data-[role=user]:max-w-[80%] group-data-[role=user]:rounded-[20px] group-data-[role=user]:bg-white group-data-[role=user]:px-3.5 group-data-[role=user]:py-1.5 group-data-[role=user]:text-zinc-900 group-data-[role=user]:leading-6 group-data-[role=user]:shadow-[0_0_0_1px_rgb(0_0_0/0.08),0_1px_2px_rgb(0_0_0/0.04)] dark:text-zinc-300 dark:group-data-[role=user]:bg-zinc-800 dark:group-data-[role=user]:text-zinc-100 dark:group-data-[role=user]:shadow-[inset_0_1px_0_rgb(255_255_255/0.05),inset_0_0_0_1px_rgb(255_255_255/0.06),0_0_0_1px_rgb(0_0_0/0.16)]">
          {message.text}
        </Message.Text>
        {message.role === "assistant" && <CopyButton value={message.text} />}
      </Message.Root>
    ))}
  </div>
);

const CopyButton = ({ value }: { value: string }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <button
      type="button"
      onClick={handleCopy}
      aria-label="Copy message"
      className="-ml-1.5 flex size-7 cursor-pointer items-center justify-center rounded-full text-zinc-400 transition-colors hover:bg-zinc-950/5 hover:text-zinc-900 focus-visible:outline-2 focus-visible:outline-[#0169cc]/60 dark:text-zinc-500 dark:hover:bg-white/8 dark:hover:text-zinc-100"
    >
      {copied ? <Check className="size-[15px]" /> : <Copy className="size-[15px]" />}
    </button>
  );
};
