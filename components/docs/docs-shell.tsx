"use client";

import type { ComponentProps, ReactNode } from "react";
import { Sidebar } from "@/components/ui/sidebar";
import { DocsSidebar } from "./docs-sidebar";

/**
 * The docs on the same shell as the playground: collapsible sidebar, mobile
 * drawer and the panel inset. A client component for the same reason as
 * ChatShell — `Sidebar` is an `Object.assign` compound, which a server
 * component would read as a proxy.
 *
 * Docs stay statically rendered, so the sidebar starts open rather than
 * restoring the cookie; the layout it writes is still shared with the chat.
 */
export const DocsShell = ({
  tree,
  children,
}: {
  tree: ComponentProps<typeof DocsSidebar>["tree"];
  children: ReactNode;
}) => (
  <Sidebar.Provider>
    <DocsSidebar tree={tree} />
    <Sidebar.Inset>
      <Sidebar.Viewport>
        {/* The panel scrolls, not the window, so the frame stays put around it. */}
        <div data-docs-scroll="" className="h-full w-full overflow-y-auto">
          {children}
        </div>
      </Sidebar.Viewport>
    </Sidebar.Inset>
  </Sidebar.Provider>
);
