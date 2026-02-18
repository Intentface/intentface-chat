"use client";

import {
  MessageSquareIcon,
  MessageSquarePlusIcon,
  MonitorIcon,
  MoonIcon,
  SunIcon,
  Trash2Icon,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import { SettingsIcon } from "@/components/icons/settings";
import DropdownMenu from "@/components/ui/dropdown-menu";
import { Sidebar } from "@/components/ui/sidebar";
import { deleteChatInstance } from "@/lib/chat-instance";
import { useChatStore } from "@/lib/store/chat";

export const AppSidebar = () => {
  const { theme, setTheme } = useTheme();
  const pathname = usePathname();
  const router = useRouter();
  const chats = useChatStore((state) => state.chats);
  const deleteChat = useChatStore((state) => state.deleteChat);

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
        <span className="px-2 text-sm font-semibold">Intentface</span>
      </Sidebar.Header>
      <Sidebar.Content>
        <Sidebar.Group>
          <Sidebar.GroupLabel>Conversations</Sidebar.GroupLabel>
          <Sidebar.GroupAction render={<Link href="/" />}>
            <MessageSquarePlusIcon />
            <span className="sr-only">New Chat</span>
          </Sidebar.GroupAction>
          <Sidebar.GroupContent>
            <Sidebar.Menu>
              {chats.length === 0 && (
                <Sidebar.MenuItem>
                  <Sidebar.MenuButton render={<Link href="/" />}>
                    <MessageSquarePlusIcon />
                    <span>New Chat</span>
                  </Sidebar.MenuButton>
                </Sidebar.MenuItem>
              )}
              {chats.map((chat) => (
                <Sidebar.MenuItem key={chat.id}>
                  <Sidebar.MenuButton
                    isActive={pathname === `/chat/${chat.id}`}
                    render={<Link href={`/chat/${chat.id}`} />}
                  >
                    <MessageSquareIcon />
                    <span>{chat.title}</span>
                  </Sidebar.MenuButton>
                  <Sidebar.MenuAction
                    showOnHover
                    onClick={() => handleDelete(chat.id)}
                  >
                    <Trash2Icon />
                    <span className="sr-only">Delete</span>
                  </Sidebar.MenuAction>
                </Sidebar.MenuItem>
              ))}
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
