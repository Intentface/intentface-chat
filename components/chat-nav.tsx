"use client";
import { Bin, MoreVertical, SquarePen } from "@keyline-icons/react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Sidebar } from "@/components/ui/sidebar";
import { deleteChatInstance } from "@/lib/chat-instance";
import { useChatStore } from "@/lib/store/chat";
import DropdownMenu from "./ui/dropdown-menu";

/** The playground half of the site sidebar: new chat and the threads. */
export const ChatNav = () => {
  const pathname = usePathname();
  const router = useRouter();
  const chats = useChatStore((state) => state.chats);
  const deleteChat = useChatStore((state) => state.deleteChat);

  const handleDelete = (chatId: string) => {
    const isActive = pathname === `/chat/${chatId}`;
    deleteChat(chatId);
    deleteChatInstance(chatId);
    if (isActive) {
      router.push("/playground");
    }
  };

  return (
    <>
      <Link
        href="/playground"
        className="flex h-[30px] shrink-0 items-center gap-2 rounded-md bg-raised px-2.5 font-medium text-ink-primary text-sm shadow-raised transition-[background-color] hover:bg-raised-hover focus-visible:outline-2 focus-visible:outline-accent-bg/60 focus-visible:outline-offset-2"
      >
        <SquarePen className="size-[15px] text-ink-body" />
        New chat
      </Link>
      <Sidebar.Content>
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
                                <MoreVertical />
                                <span className="sr-only">Delete</span>
                              </Sidebar.MenuAction>
                            }
                          />
                          <DropdownMenu.Content>
                            <DropdownMenu.Item
                              onClick={() => handleDelete(chat.id)}
                              aria-label="Delete"
                            >
                              <Bin />
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
    </>
  );
};
