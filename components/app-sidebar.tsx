"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { IntentfaceLogo } from "@/components/icons/intentface-logo";
import { PlusMediumIcon } from "@/components/icons/plus-medium";
import { TrashIcon } from "@/components/icons/trash";
import { Sidebar } from "@/components/ui/sidebar";
import { deleteChatInstance } from "@/lib/chat-instance";
import { useChatStore } from "@/lib/store/chat";
import { BookIcon } from "./icons/book";
import { GitHubIcon } from "./icons/github";
import { NpmIcon } from "./icons/npm";

export const AppSidebar = () => {
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
      <Sidebar.Header className="flex-row items-center justify-between">
        <IntentfaceLogo className="size-6" />
        <Sidebar.Trigger />
      </Sidebar.Header>
      <Sidebar.Content>
        <Sidebar.Group>
          <Sidebar.Menu>
            <Sidebar.MenuItem>
              <Sidebar.MenuButton
                isActive={pathname === "/"}
                render={
                  <Link href="/">
                    <PlusMediumIcon />
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
                          <TrashIcon />
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
                  <BookIcon />
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
        </Sidebar.Menu>
      </Sidebar.Footer>
    </Sidebar>
  );
};
