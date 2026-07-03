"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
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
        "block rounded-md px-3 py-1.5 text-sm transition-colors",
        isActive
          ? "bg-primary-hover font-medium text-ink-primary"
          : "text-ink-secondary hover:bg-primary-hover hover:text-ink-primary",
      )}
    >
      {name}
    </Link>
  );
};

const TreeNodes = ({ nodes }: { nodes: TreeNode[] }) => (
  <ul className="flex flex-col gap-0.5">
    {nodes.map((node, index) => {
      if (node.type === "separator") {
        return (
          <li
            key={`sep-${index}`}
            className="px-3 pt-4 pb-1 font-medium text-ink-tertiary text-xs uppercase tracking-wider"
          >
            {node.name}
          </li>
        );
      }
      if (node.type === "folder") {
        return (
          <li key={`folder-${index}`} className="pt-3">
            <p className="px-3 pb-1 font-medium text-ink-tertiary text-xs uppercase tracking-wider">
              {node.name}
            </p>
            <TreeNodes nodes={node.children} />
          </li>
        );
      }
      return (
        <li key={node.url}>
          <NavLink url={node.url} name={node.name} />
        </li>
      );
    })}
  </ul>
);

export const DocsSidebar = ({ tree }: DocsSidebarProps) => (
  <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col gap-4 overflow-y-auto border-primary-border border-r py-6 pr-4 md:flex">
    <Link href="/docs" className="px-3 font-semibold text-ink-primary">
      @intentface/chat
    </Link>
    <DocsSearch />
    <nav className="flex-1">
      <TreeNodes nodes={tree.children} />
    </nav>
  </aside>
);
