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
import { DotGrid1x3VerticalTightIcon } from "./icons/dot-grid-1x3-vertical-tight";
import { GitHubIcon } from "./icons/github";
import { NpmIcon } from "./icons/npm";
import DropdownMenu from "./ui/dropdown-menu";

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
                        <DropdownMenu>
                          <DropdownMenu.Trigger
                            render={
                              <Sidebar.MenuAction showOnHover>
                                <DotGrid1x3VerticalTightIcon />
                                <span className="sr-only">Delete</span>
                              </Sidebar.MenuAction>
                            }
                          />
                          <DropdownMenu.Content>
                            <DropdownMenu.Item
                              onClick={() => handleDelete(chat.id)}
                              aria-label="Delete"
                            >
                              <TrashIcon />
                              Delete
                              <span className="sr-only">Delete</span>
                            </DropdownMenu.Item>
                          </DropdownMenu.Content>
                        </DropdownMenu>
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
