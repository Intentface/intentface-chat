"use client";

import { useState } from "react";
import { Chat } from "@/components/chat";

export default function Home() {
  // A lazy state initializer mints the id exactly once per mount; useMemo may
  // recompute it, which would swap the chat instance out from under the user.
  const [chatId] = useState(() => crypto.randomUUID());

  return <Chat chatId={chatId} />;
}
