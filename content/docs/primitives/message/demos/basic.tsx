"use client";

import { Message } from "@intentface/chat/message";
import { type ComponentProps, useState } from "react";

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
      {copied ? <CheckIcon /> : <CopyIcon />}
    </button>
  );
};

const CopyIcon = (props: ComponentProps<"svg">) => (
  <svg
    width="14"
    height="14"
    viewBox="0 0 16 16"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.5"
    strokeLinejoin="round"
    aria-hidden="true"
    {...props}
  >
    <rect x="5.5" y="5.5" width="8" height="8" rx="1.5" />
    <path d="M10.5 3.5v-.5a1.5 1.5 0 0 0-1.5-1.5H3a1.5 1.5 0 0 0-1.5 1.5v6A1.5 1.5 0 0 0 3 10.5h.5" />
  </svg>
);

const CheckIcon = (props: ComponentProps<"svg">) => (
  <svg
    width="14"
    height="14"
    viewBox="0 0 16 16"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.5"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
    {...props}
  >
    <path d="m2.5 8.5 4 4 7-9" />
  </svg>
);
