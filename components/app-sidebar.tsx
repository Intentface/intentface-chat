"use client";

import {
  FlaskConicalIcon,
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
import { useSettingsStore } from "@/lib/store/settings";
import { EditIcon } from "./icons/edit";

export const AppSidebar = () => {
  const { theme, setTheme } = useTheme();
  const pathname = usePathname();
  const router = useRouter();
  const chats = useChatStore((state) => state.chats);
  const deleteChat = useChatStore((state) => state.deleteChat);
  const { showBalsam, setShowBalsam } = useSettingsStore();

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
          <Sidebar.Menu>
            <Sidebar.MenuItem>
              <Sidebar.MenuButton
                render={
                  <Link href="/">
                    <EditIcon />
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
                        <Sidebar.MenuAction
                          showOnHover
                          onClick={() => handleDelete(chat.id)}
                        >
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
                <DropdownMenu.Item inset>
                  Test Dropdown Menu Item
                </DropdownMenu.Item>
                <DropdownMenu.Item inset>
                  Test Dropdown Menu Item
                </DropdownMenu.Item>
                <DropdownMenu.Item inset>
                  Test Dropdown Menu Item
                </DropdownMenu.Item>
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
                <DropdownMenu.Separator />
                <DropdownMenu.CheckboxItem
                  checked={showBalsam}
                  onCheckedChange={setShowBalsam}
                >
                  <FlaskConicalIcon />
                  Balsam Mock API
                </DropdownMenu.CheckboxItem>
              </DropdownMenu.Content>
            </DropdownMenu>
          </Sidebar.MenuItem>
        </Sidebar.Menu>
      </Sidebar.Footer>
    </Sidebar>
  );
};
