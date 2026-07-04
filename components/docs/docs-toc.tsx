"use client";

import type { TOCItemType } from "fumadocs-core/toc";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

type DocsTOCProps = {
  items: TOCItemType[];
};

// Right-rail table of contents with an active-heading tracker. Uses a single
// IntersectionObserver over the heading targets rather than scroll math.
export const DocsTOC = ({ items }: DocsTOCProps) => {
  const [activeId, setActiveId] = useState<string | null>(null);

  useEffect(() => {
    const ids = items.map((item) => item.url.replace(/^#/, ""));
    const headings = ids
      .map((id) => document.getElementById(id))
      .filter((el): el is HTMLElement => el !== null);
    if (headings.length === 0) return;

    const visible = new Set<string>();
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) visible.add(entry.target.id);
          else visible.delete(entry.target.id);
        }
        // Highest heading still in view wins; clear when none are visible (Overview).
        const firstVisible = headings.find((h) => visible.has(h.id));
        setActiveId(firstVisible?.id ?? null);
      },
      { rootMargin: "0px 0px -70% 0px", threshold: 0 },
    );

    for (const heading of headings) observer.observe(heading);
    return () => observer.disconnect();
  }, [items]);

  if (items.length === 0) return null;

  const linkClass = (isActive: boolean, depth = 2) =>
    cn(
      "-ml-px border-transparent border-l py-1 text-sm transition-colors",
      depth >= 3 ? "pl-6" : "pl-4",
      isActive
        ? "border-accent font-medium text-ink-primary"
        : "text-ink-tertiary hover:text-ink-secondary",
    );

  return (
    <aside className="sticky top-16 hidden h-[calc(100vh-8rem)] w-56 shrink-0 overflow-y-auto pb-10 xl:block">
      <nav className="flex flex-col gap-1 border-primary-border border-l">
        <a href="#overview" className={linkClass(activeId === null)}>
          Overview
        </a>
        {items.map((item) => {
          const id = item.url.replace(/^#/, "");
          const isActive = activeId === id;
          return (
            <a key={item.url} href={item.url} className={linkClass(isActive, item.depth)}>
              {item.title}
            </a>
          );
        })}
      </nav>
    </aside>
  );
};
