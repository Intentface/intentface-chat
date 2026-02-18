"use client";

import {
  MessageSquarePlusIcon,
  MonitorIcon,
  MoonIcon,
  SunIcon,
} from "lucide-react";
import { useTheme } from "next-themes";
import { SettingsIcon } from "@/components/icons/settings";
import DropdownMenu from "@/components/ui/dropdown-menu";
import { Sidebar } from "@/components/ui/sidebar";

export const AppSidebar = () => {
  const { theme, setTheme } = useTheme();

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
      <Sidebar.Footer>
        <Sidebar.Menu>
          <Sidebar.MenuItem>
            <DropdownMenu>
              <DropdownMenu.Trigger
                render={
                  <Sidebar.MenuButton>
                    <SettingsIcon />
                    <span>Settings</span>
                  </Sidebar.MenuButton>
                }
              />
              <DropdownMenu.Content side="top" align="start">
                <DropdownMenu.Sub>
                  <DropdownMenu.SubTrigger>
                    <SunIcon />
                    Theme
                  </DropdownMenu.SubTrigger>
                  <DropdownMenu.SubContent>
                    <DropdownMenu.RadioGroup
                      value={theme}
                      onValueChange={setTheme}
                    >
                      <DropdownMenu.RadioItem value="system">
                        <MonitorIcon />
                        System
                      </DropdownMenu.RadioItem>
                      <DropdownMenu.RadioItem value="light">
                        <SunIcon />
                        Light
                      </DropdownMenu.RadioItem>
                      <DropdownMenu.RadioItem value="dark">
                        <MoonIcon />
                        Dark
                      </DropdownMenu.RadioItem>
                    </DropdownMenu.RadioGroup>
                  </DropdownMenu.SubContent>
                </DropdownMenu.Sub>
              </DropdownMenu.Content>
            </DropdownMenu>
          </Sidebar.MenuItem>
        </Sidebar.Menu>
      </Sidebar.Footer>
    </Sidebar>
  );
};
