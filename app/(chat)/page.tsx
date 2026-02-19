"use client";

import { useMemo } from "react";
import { Chat } from "@/components/chat";

export default function Home() {
  const chatId = useMemo(() => crypto.randomUUID(), []);

  return <Chat chatId={chatId} />;
}
