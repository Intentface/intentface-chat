"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { type ReactNode, useEffect, useMemo, useState } from "react";
import { ChevronDownIcon } from "@/components/icons/chevron-down";
import { GitHubIcon } from "@/components/icons/github";
import { IntentfaceLogo } from "@/components/icons/intentface-logo";
import { NpmIcon } from "@/components/icons/npm";
import { Collapsible } from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";
import { DocsSearch } from "./docs-search";

// Structural mirror of fumadocs' page-tree nodes (typeof source.pageTree). We
// only render the two node shapes our docs use: pages and one level of folder.
type TreeItem = { type: "page"; name: ReactNode; url: string };
type TreeFolder = {
  type: "folder";
  name: ReactNode;
  index?: TreeItem;
  children: TreeNode[];
};
type TreeSeparator = { type: "separator"; name?: ReactNode };
type TreeNode = TreeItem | TreeFolder | TreeSeparator;

type DocsSidebarProps = {
  tree: { children: TreeNode[] };
};

const NavLink = ({ url, name }: { url: string; name: ReactNode }) => {
  const pathname = usePathname();
  const isActive = pathname === url;
  return (
    <Link
      href={url}
      className={cn(
        "flex h-8 items-center rounded-md px-3 text-md font-medium transition-colors duration-0",
        isActive
          ? "bg-secondary-hover text-ink-primary"
          : "text-ink-secondary hover:bg-secondary-hover hover:text-ink-primary",
      )}
    >
      {name}
    </Link>
  );
};

const hasActiveNode = (nodes: TreeNode[], pathname: string): boolean =>
  nodes.some((child) => {
    if (child.type === "page") return child.url === pathname;
    if (child.type === "folder") {
      if (child.index?.url === pathname) return true;
      return hasActiveNode(child.children, pathname);
    }
    return false;
  });

const TreeFolderNode = ({ node, index }: { node: TreeFolder; index: number }) => {
  const pathname = usePathname();
  const containsActive = useMemo(
    () => hasActiveNode(node.children, pathname) || node.index?.url === pathname,
    [node, pathname],
  );
  const [open, setOpen] = useState(true);

  useEffect(() => {
    if (containsActive) setOpen(true);
  }, [containsActive]);

  return (
    <li key={`folder-${index}`} className="mt-2">
      <Collapsible open={open} onOpenChange={setOpen}>
        <Collapsible.Trigger className="flex h-8 w-full cursor-pointer items-center gap-1.5 rounded-md px-3 text-left font-medium text-ink-tertiary text-md transition-colors duration-0 hover:bg-secondary-hover hover:text-ink-secondary">
          <span className="flex-1">{node.name}</span>
          <ChevronDownIcon
            className={cn(
              "size-[18px] shrink-0 transition-transform",
              open ? "rotate-0" : "-rotate-90",
            )}
          />
        </Collapsible.Trigger>
        <Collapsible.Panel>
          <TreeNodes nodes={node.children} />
        </Collapsible.Panel>
      </Collapsible>
    </li>
  );
};

const TreeNodes = ({ nodes }: { nodes: TreeNode[] }) => (
  <ul className="flex flex-col gap-0.5">
    {nodes.map((node, index) => {
      if (node.type === "separator") {
        return (
          <li
            key={`sep-${index}`}
            className="mt-2 flex h-8 items-center px-3 font-medium text-ink-tertiary text-md"
          >
            {node.name}
          </li>
        );
      }
      if (node.type === "folder") {
        return <TreeFolderNode key={`folder-${index}`} node={node} index={index} />;
      }
      return (
        <li key={node.url}>
          <NavLink url={node.url} name={node.name} />
        </li>
      );
    })}
  </ul>
);

const ExternalLink = ({ href, icon, label }: { href: string; icon: ReactNode; label: string }) => (
  <a
    href={href}
    target="_blank"
    rel="noreferrer"
    className="flex h-8 items-center gap-2 rounded-md px-3 font-medium text-ink-secondary text-md transition-colors duration-0 hover:bg-secondary-hover hover:text-ink-primary"
  >
    <span className="[&>svg]:size-4">{icon}</span>
    {label}
  </a>
);

export const DocsSidebar = ({ tree }: DocsSidebarProps) => (
  <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col gap-2 overflow-y-auto border-secondary-border border-r p-3 md:flex">
    <Link
      href="/docs"
      className="flex h-8 items-center px-3 text-ink-primary"
      aria-label="@intentface/chat"
    >
      <IntentfaceLogo className="size-6" />
    </Link>
    <div className="shrink-0">
      <DocsSearch />
    </div>
    <nav className="flex-1">
      <TreeNodes nodes={tree.children} />
    </nav>
    <div className="flex flex-col gap-0.5 border-secondary-border border-t pt-2">
      <ExternalLink
        href="https://github.com/Intentface/intentface-chat"
        icon={<GitHubIcon />}
        label="GitHub"
      />
      <ExternalLink
        href="https://www.npmjs.com/package/@intentface/chat"
        icon={<NpmIcon />}
        label="npm"
      />
    </div>
  </aside>
);
