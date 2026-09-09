"use client";

import type { ReactNode } from "react";
import { AppSidebar } from "@/components/app-sidebar";
import { Sidebar } from "@/components/ui/sidebar";

/**
 * The chat area's shell composition.
 *
 * Its own client component rather than the layout itself, because `Sidebar` is
 * an `Object.assign` compound: a server component importing it gets a proxy of
 * the module's named exports and reads `undefined` off `Sidebar.Provider`.
 * The layout stays a server component so it can read the sidebar cookie before
 * the first paint and hand it down as `defaultOpen`.
 */
export const ChatShell = ({
  defaultOpen,
  width,
  children,
}: {
  defaultOpen: boolean;
  width?: number;
  children: ReactNode;
}) => (
  <Sidebar.Provider defaultOpen={defaultOpen} width={width}>
    <AppSidebar />
    <Sidebar.Inset>
      <Sidebar.Viewport>{children}</Sidebar.Viewport>
    </Sidebar.Inset>
  </Sidebar.Provider>
);
