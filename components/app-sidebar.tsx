"use client";

import {
  FlaskConicalIcon,
  MonitorIcon,
  MoonIcon,
  PaletteIcon,
  PlusIcon,
  SunIcon,
  Trash2Icon,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import { useState } from "react";
import type { ThreadAutoScrollMode } from "@/components/ai/thread";
import { ArrowDownIcon } from "@/components/icons/arrow-down";
import { IntentfaceLogo } from "@/components/icons/intentface-logo";
import { SettingsIcon } from "@/components/icons/settings";
import { ThemeConfigurator } from "@/components/theme-configurator";
import DropdownMenu from "@/components/ui/dropdown-menu";
import { Sidebar } from "@/components/ui/sidebar";
import { deleteChatInstance } from "@/lib/chat-instance";
import { useChatStore } from "@/lib/store/chat";
import { useSettingsStore } from "@/lib/store/settings";
import { FileTextIcon } from "./icons/file-text";
import { GitHubIcon } from "./icons/github";
import { NpmIcon } from "./icons/npm";

export const AppSidebar = () => {
  const { theme, setTheme } = useTheme();
  const pathname = usePathname();
  const router = useRouter();
  const chats = useChatStore((state) => state.chats);
  const deleteChat = useChatStore((state) => state.deleteChat);
  const scrollMode = useSettingsStore((state) => state.scrollMode);
  const setScrollMode = useSettingsStore((state) => state.setScrollMode);
  const stickyMessages = useSettingsStore((state) => state.stickyMessages);
  const setStickyMessages = useSettingsStore((state) => state.setStickyMessages);
  const [themeConfiguratorOpen, setThemeConfiguratorOpen] = useState(false);

  const handleDelete = (chatId: string) => {
    const isActive = pathname === `/chat/${chatId}`;
    deleteChat(chatId);
    deleteChatInstance(chatId);
    if (isActive) {
      router.push("/");
    }
  };

  return (
    <Sidebar>
      <Sidebar.Header>
        <IntentfaceLogo className="size-6" />
      </Sidebar.Header>
      <Sidebar.Content>
        <Sidebar.Group>
          <Sidebar.Menu>
            <Sidebar.MenuItem>
              <Sidebar.MenuButton
                isActive={pathname === "/"}
                render={
                  <Link href="/">
                    <PlusIcon />
                    <span>New Chat</span>
                  </Link>
                }
              />
            </Sidebar.MenuItem>
          </Sidebar.Menu>
        </Sidebar.Group>
        <Sidebar.Group>
          <Sidebar.GroupLabel>Threads</Sidebar.GroupLabel>
          <Sidebar.GroupContent>
            <Sidebar.Menu>
              {chats.map((chat) => (
                <Sidebar.MenuItem key={chat.id}>
                  <Sidebar.MenuButton
                    isActive={pathname === `/chat/${chat.id}`}
                    render={
                      <Link href={`/chat/${chat.id}`}>
                        <span className="flex-1 truncate">{chat.title}</span>
                        <Sidebar.MenuAction showOnHover onClick={() => handleDelete(chat.id)}>
                          <Trash2Icon />
                          <span className="sr-only">Delete</span>
                        </Sidebar.MenuAction>
                      </Link>
                    }
                  />
                </Sidebar.MenuItem>
              ))}
            </Sidebar.Menu>
          </Sidebar.GroupContent>
        </Sidebar.Group>
      </Sidebar.Content>
      <Sidebar.Footer>
        <Sidebar.Menu>
          <Sidebar.MenuItem>
            <Sidebar.MenuButton
              render={
                <Link href="/docs">
                  <FileTextIcon />
                  <span>Docs</span>
                </Link>
              }
            />
          </Sidebar.MenuItem>
          <Sidebar.MenuItem>
            <Sidebar.MenuButton
              render={
                <a
                  href="https://github.com/Intentface/intentface-chat"
                  target="_blank"
                  rel="noreferrer"
                >
                  <GitHubIcon />
                  <span>GitHub</span>
                </a>
              }
            />
          </Sidebar.MenuItem>
          <Sidebar.MenuItem>
            <Sidebar.MenuButton
              render={
                <a
                  href="https://www.npmjs.com/package/@intentface/chat"
                  target="_blank"
                  rel="noreferrer"
                >
                  <NpmIcon />
                  <span>npm</span>
                </a>
              }
            />
          </Sidebar.MenuItem>
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
                <DropdownMenu.Item onClick={() => setThemeConfiguratorOpen(true)}>
                  <PaletteIcon />
                  Appearance
                </DropdownMenu.Item>
                <DropdownMenu.Item
                  render={
                    <Link href="/playground">
                      <FlaskConicalIcon />
                      Playground
                    </Link>
                  }
                />
                <DropdownMenu.Sub>
                  <DropdownMenu.SubTrigger>
                    <SunIcon />
                    Theme
                  </DropdownMenu.SubTrigger>
                  <DropdownMenu.SubContent>
                    <DropdownMenu.RadioGroup value={theme} onValueChange={setTheme}>
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
                <DropdownMenu.Sub>
                  <DropdownMenu.SubTrigger>
                    <ArrowDownIcon />
                    Scroll
                  </DropdownMenu.SubTrigger>
                  <DropdownMenu.SubContent>
                    <DropdownMenu.RadioGroup
                      value={scrollMode}
                      onValueChange={(value) => setScrollMode(value as ThreadAutoScrollMode)}
                    >
                      <DropdownMenu.RadioItem value="follow">Follow</DropdownMenu.RadioItem>
                      <DropdownMenu.RadioItem value="jump">Jump to top</DropdownMenu.RadioItem>
                      <DropdownMenu.RadioItem value="bottom">Bottom</DropdownMenu.RadioItem>
                      <DropdownMenu.RadioItem value="off">Off</DropdownMenu.RadioItem>
                    </DropdownMenu.RadioGroup>
                  </DropdownMenu.SubContent>
                </DropdownMenu.Sub>
                <DropdownMenu.CheckboxItem
                  checked={stickyMessages}
                  onCheckedChange={setStickyMessages}
                >
                  Sticky messages
                </DropdownMenu.CheckboxItem>
              </DropdownMenu.Content>
            </DropdownMenu>
            <ThemeConfigurator
              open={themeConfiguratorOpen}
              onOpenChange={setThemeConfiguratorOpen}
            />
          </Sidebar.MenuItem>
        </Sidebar.Menu>
      </Sidebar.Footer>
    </Sidebar>
  );
};
