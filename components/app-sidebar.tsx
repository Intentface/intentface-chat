"use client";
import { Bin, BookOpen, MoreVertical, SquarePen } from "@keyline-icons/react";
// Keyline has no brand icons, so these two stay on Tabler.
import { IconBrandGithub, IconBrandNpm } from "@tabler/icons-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { LogoTile } from "@/components/icons/logo-tile";
import { IconButton } from "@/components/ui/icon-button";
import { Sidebar } from "@/components/ui/sidebar";
import { deleteChatInstance } from "@/lib/chat-instance";
import { useChatStore } from "@/lib/store/chat";
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
      router.push("/playground");
    }
  };

  return (
    <Sidebar>
      <Sidebar.Header className="h-10 shrink-0 flex-row items-center justify-between pr-1 pl-2">
        <Link href="/playground" className="flex items-center gap-2.5 text-ink-primary">
          <LogoTile />
          <span className="font-semibold text-md tracking-[-0.01em]">intentface/chat</span>
        </Link>
        <Sidebar.Trigger className="size-7" />
      </Sidebar.Header>
      <Link
        href="/playground"
        className="flex h-[34px] shrink-0 items-center gap-2 rounded-md bg-raised px-2.5 font-medium text-ink-primary text-sm shadow-raised transition-[background-color] hover:bg-raised-hover focus-visible:outline-2 focus-visible:outline-accent-bg/60 focus-visible:outline-offset-2"
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
      <Sidebar.Footer className="flex-row items-center justify-between border-ink-primary/8 border-t pt-2 pr-1 pl-0.5">
        <Link
          href="/"
          className="flex h-[30px] items-center gap-[7px] rounded-md pr-2 pl-1.5 font-medium text-ink-body text-sm transition-colors hover:bg-ink-primary/5 hover:text-ink-primary focus-visible:outline-2 focus-visible:outline-accent-bg/60"
        >
          <BookOpen className="size-[15px] text-ink-secondary" />
          Docs
        </Link>
        <div className="flex items-center gap-0.5">
          <IconButton
            variant="ghost"
            size="sm"
            nativeButton={false}
            aria-label="GitHub"
            className="rounded-md"
            render={
              <a
                href="https://github.com/Intentface/intentface-chat"
                target="_blank"
                rel="noreferrer"
              >
                <IconBrandGithub />
              </a>
            }
          />
          <IconButton
            variant="ghost"
            size="sm"
            nativeButton={false}
            aria-label="npm"
            className="rounded-md"
            render={
              <a
                href="https://www.npmjs.com/package/@intentface/chat"
                target="_blank"
                rel="noreferrer"
              >
                <IconBrandNpm />
              </a>
            }
          />
        </div>
      </Sidebar.Footer>
    </Sidebar>
  );
};
