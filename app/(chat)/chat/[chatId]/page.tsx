"use client";

import { use } from "react";
import { Chat } from "@/components/chat";

export default function ChatPage({
  params,
}: {
  params: Promise<{ chatId: string }>;
}) {
  const { chatId } = use(params);

  return <Chat chatId={chatId} />;
}
