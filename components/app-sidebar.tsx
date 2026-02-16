"use client";

import { MessageSquarePlusIcon } from "lucide-react";
import { Sidebar } from "@/components/ui/sidebar";

export const AppSidebar = () => {
  return (
    <Sidebar>
      <Sidebar.Header>
        <span className="px-2 text-sm font-semibold">Intentface</span>
      </Sidebar.Header>
      <Sidebar.Content>
        <Sidebar.Group>
          <Sidebar.GroupLabel>Conversations</Sidebar.GroupLabel>
          <Sidebar.GroupContent>
            <Sidebar.Menu>
              <Sidebar.MenuItem>
                <Sidebar.MenuButton>
                  <MessageSquarePlusIcon />
                  <span>New Chat</span>
                </Sidebar.MenuButton>
              </Sidebar.MenuItem>
            </Sidebar.Menu>
          </Sidebar.GroupContent>
        </Sidebar.Group>
      </Sidebar.Content>
      <Sidebar.Footer />
    </Sidebar>
  );
};
