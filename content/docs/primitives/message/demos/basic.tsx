"use client";

import { Message } from "@intentface/chat/message";
import { IconCheck, IconCopy } from "@tabler/icons-react";
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
  <div className="flex w-full max-w-xl flex-col gap-4">
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
      className="flex size-7 cursor-pointer items-center justify-center rounded-md text-[#949494] transition-colors hover:bg-[#f4f4f4] hover:text-[#1a1a1a] dark:text-[#6f6f6f] dark:hover:bg-[#232323] dark:hover:text-[#fcfcfc]"
    >
      {copied ? <IconCheck className="size-3.5" /> : <IconCopy className="size-4" />}
    </button>
  );
};
