"use client";

// Keyline has no brand or sandbox icons, so these stay on Tabler.
import { IconBrandGithub, IconBrandNpm, IconSandbox } from "@tabler/icons-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { LogoTile } from "@/components/icons/logo-tile";
import { IconButton } from "@/components/ui/icon-button";
import { Sidebar } from "@/components/ui/sidebar";
import { DocsSearch, type SearchSuggestion } from "./docs-search";
import { DocsThemeToggle } from "./docs-theme-toggle";

// Structural mirror of fumadocs' page-tree nodes (typeof source.pageTree). We
// only render the node shapes our docs use: pages, separators and one level of folder.
type TreeItem = { type: "page"; name: ReactNode; url: string };
type TreeFolder = { type: "folder"; name: ReactNode; children: TreeNode[] };
type TreeSeparator = { type: "separator"; name?: ReactNode };
type TreeNode = TreeItem | TreeFolder | TreeSeparator;

type NavGroup = { label?: ReactNode; items: TreeItem[] };

type DocsSidebarProps = {
  tree: { children: TreeNode[] };
};

// Pages to flag as new in the sidebar. Drop a URL once its primitive has been
// out for a release or two.
const NEW_PAGES = new Set(["/primitives/shell", "/primitives/nav", "/primitives/tabs"]);

// A separator opens a labelled group for the root pages after it; a folder is a
// group of its own.
const toGroups = (nodes: TreeNode[]): NavGroup[] => {
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
const toSuggestions = (groups: NavGroup[]): SearchSuggestion[] =>
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

const FooterLink = ({ href, label, icon }: { href: string; label: string; icon: ReactNode }) => (
  <IconButton
    variant="ghost"
    size="sm"
    nativeButton={false}
    aria-label={label}
    className="rounded-md"
    render={
      <a href={href} target="_blank" rel="noreferrer">
        {icon}
      </a>
    }
  />
);

export const DocsSidebar = ({ tree }: DocsSidebarProps) => {
  const groups = toGroups(tree.children);

  return (
    <Sidebar>
      <Sidebar.Header className="h-10 shrink-0 flex-row items-center justify-between pr-1 pl-2">
        <Link
          href="/"
          className="flex items-center gap-2.5 text-ink-primary"
          aria-label="@intentface/chat docs"
        >
          <LogoTile />
          <span className="font-semibold text-md tracking-[-0.01em]">intentface/chat</span>
        </Link>
        <div className="flex items-center gap-1.5">
          <DocsSearch suggestions={toSuggestions(groups)} />
          <Sidebar.Trigger className="size-7" />
        </div>
      </Sidebar.Header>
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
      <Sidebar.Footer className="flex-row items-center justify-between border-ink-primary/8 border-t pt-2 pr-1 pl-0.5">
        {/* Internal route — next/link. The chat root IS the playground. */}
        <Link
          href="/playground"
          className="flex h-[30px] items-center gap-[7px] rounded-md pr-2 pl-1.5 font-medium text-ink-body text-sm transition-colors hover:bg-ink-primary/5 hover:text-ink-primary [&>svg]:size-[15px] [&>svg]:text-ink-secondary"
        >
          <IconSandbox />
          Playground
        </Link>
        <div className="flex items-center gap-0.5">
          <FooterLink
            href="https://github.com/Intentface/intentface-chat"
            label="GitHub"
            icon={<IconBrandGithub />}
          />
          <FooterLink
            href="https://www.npmjs.com/package/@intentface/chat"
            label="npm"
            icon={<IconBrandNpm />}
          />
          <DocsThemeToggle />
        </div>
      </Sidebar.Footer>
    </Sidebar>
  );
};
