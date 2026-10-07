"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { Sidebar } from "@/components/ui/sidebar";
import type { SearchSuggestion } from "./docs-search";

// Structural mirror of fumadocs' page-tree nodes (typeof source.pageTree). We
// only render the node shapes our docs use: pages, separators and one level of folder.
type TreeItem = { type: "page"; name: ReactNode; url: string };
type TreeFolder = { type: "folder"; name: ReactNode; children: TreeNode[] };
type TreeSeparator = { type: "separator"; name?: ReactNode };
type TreeNode = TreeItem | TreeFolder | TreeSeparator;

export type NavGroup = { label?: ReactNode; items: TreeItem[] };

export type DocsTree = { children: TreeNode[] };

// Pages to flag as new in the sidebar. Drop a URL once its primitive has been
// out for a release or two.
const NEW_PAGES = new Set(["/primitives/shell", "/primitives/nav", "/primitives/tabs"]);

// A separator opens a labelled group for the root pages after it; a folder is a
// group of its own.
export const toGroups = (nodes: TreeNode[]): NavGroup[] => {
  const groups: NavGroup[] = [];
  let open: NavGroup | null = null;

  for (const node of nodes) {
    switch (node.type) {
      case "separator":
        open = { label: node.name, items: [] };
        groups.push(open);
        break;
      case "folder":
        groups.push({
          label: node.name,
          items: node.children.filter((child): child is TreeItem => child.type === "page"),
        });
        open = null;
        break;
      case "page":
        if (!open) {
          open = { items: [] };
          groups.push(open);
        }
        open.items.push(node);
        break;
    }
  }

  return groups;
};

// The search palette opens on these before anything is typed.
export const toSuggestions = (groups: NavGroup[]): SearchSuggestion[] =>
  groups
    .flatMap((group) => group.items)
    .filter((item) => item.url.startsWith("/primitives/"))
    .map((item) => ({
      url: item.url,
      title: typeof item.name === "string" ? item.name : item.url,
    }));

const NavLink = ({ item }: { item: TreeItem }) => {
  const pathname = usePathname();

  return (
    <Sidebar.MenuItem>
      <Sidebar.MenuButton
        isActive={pathname === item.url}
        render={
          <Link href={item.url}>
            <span className="min-w-0 flex-1 truncate">{item.name}</span>
            {NEW_PAGES.has(item.url) && (
              <span className="flex h-[18px] shrink-0 items-center rounded-[5px] bg-accent-bg/10 px-1.5 font-medium text-2xs text-accent-bg dark:bg-accent-bg/15">
                New
              </span>
            )}
          </Link>
        }
      />
    </Sidebar.MenuItem>
  );
};

/** The docs half of the site sidebar: the page tree. */
export const DocsNav = ({ groups }: { groups: NavGroup[] }) => (
  <Sidebar.Content className="gap-[18px]">
    {groups.map((group, index) => (
      <Sidebar.Group key={typeof group.label === "string" ? group.label : index}>
        {group.label && <Sidebar.GroupLabel>{group.label}</Sidebar.GroupLabel>}
        <Sidebar.Menu>
          {group.items.map((item) => (
            <NavLink key={item.url} item={item} />
          ))}
        </Sidebar.Menu>
      </Sidebar.Group>
    ))}
  </Sidebar.Content>
);
