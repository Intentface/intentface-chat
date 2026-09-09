import { cookies } from "next/headers";
import type { ReactNode } from "react";
import { ChatShell } from "@/components/chat-shell";
import { readSidebarLayout } from "@/lib/sidebar-cookie";

// A server component on purpose: the sidebar's layout is restored from the
// request here, so the first paint is already collapsed or expanded rather than
// snapping a frame later. Shell never reads storage itself for exactly this
// reason — the value has to arrive as a prop.
export default async function ChatLayout({ children }: { children: ReactNode }) {
  const stored = readSidebarLayout((await cookies()).toString());

  return (
    <ChatShell defaultOpen={stored?.open ?? true} width={stored?.width}>
      {children}
    </ChatShell>
  );
}
