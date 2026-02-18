"use client";

import type { ReactNode } from "react";
import { AppSidebar } from "@/components/app-sidebar";
import { ArtifactsPanel } from "@/components/artifacts-panel";
import { Sidebar } from "@/components/ui/sidebar";

export default function ChatLayout({ children }: { children: ReactNode }) {
  return (
    <Sidebar.Provider>
      <AppSidebar />
      <Sidebar.Inset>
        <Sidebar.Viewport>
          {children}
          <ArtifactsPanel />
        </Sidebar.Viewport>
      </Sidebar.Inset>
    </Sidebar.Provider>
  );
}
