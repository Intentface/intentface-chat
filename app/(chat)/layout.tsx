"use client";

import type { ReactNode } from "react";
import { AppSidebar } from "@/components/app-sidebar";
import { Sidebar } from "@/components/ui/sidebar";

export default function ChatLayout({ children }: { children: ReactNode }) {
  return (
    <Sidebar.Provider>
      <AppSidebar />
      <Sidebar.Inset>
        <Sidebar.Viewport>{children}</Sidebar.Viewport>
      </Sidebar.Inset>
    </Sidebar.Provider>
  );
}
