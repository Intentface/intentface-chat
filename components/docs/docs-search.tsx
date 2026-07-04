"use client";

import { useDocsSearch } from "fumadocs-core/search/client";
import { SearchIcon } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Dialog } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

export const DocsSearch = () => {
  const [open, setOpen] = useState(false);
  // The "fetch" preset queries the /api/search route handler (createFromSource).
  const { search, setSearch, query } = useDocsSearch({ type: "fetch" });

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "k" && (event.metaKey || event.ctrlKey)) {
        event.preventDefault();
        setOpen((value) => !value);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const results = Array.isArray(query.data) ? query.data : [];

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Dialog.Trigger
        className={cn(
          "flex h-8 w-full items-center gap-2 rounded-md border border-primary-border bg-primary px-3",
          "text-ink-tertiary text-sm transition-colors hover:bg-primary-hover",
        )}
      >
        <SearchIcon className="size-4 shrink-0" />
        <span className="flex-1 text-left">Search docs</span>
        <kbd className="rounded border border-primary-border px-1.5 py-0.5 font-mono text-2xs">
          ⌘K
        </kbd>
      </Dialog.Trigger>
      <Dialog.Content className="top-24 max-w-lg translate-y-0 p-0">
        <Dialog.Title className="sr-only">Search documentation</Dialog.Title>
        <div className="flex items-center gap-2 border-secondary-border border-b px-4">
          <SearchIcon className="size-4 shrink-0 text-ink-tertiary" />
          <input
            autoFocus
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search documentation..."
            className="w-full bg-transparent py-3 text-ink-primary text-sm outline-none placeholder:text-ink-tertiary"
          />
        </div>
        <div className="max-h-80 overflow-y-auto p-2">
          {results.length === 0 ? (
            <p className="px-3 py-6 text-center text-ink-tertiary text-sm">
              {search ? "No results found." : "Type to search."}
            </p>
          ) : (
            <ul className="flex flex-col gap-0.5">
              {results.map((result) => (
                <li key={result.id}>
                  <Link
                    href={result.url}
                    onClick={() => setOpen(false)}
                    className={cn(
                      "block rounded-md px-3 py-2 text-sm transition-colors hover:bg-secondary-hover",
                      result.type === "page"
                        ? "font-medium text-ink-primary"
                        : "pl-6 text-ink-secondary",
                    )}
                  >
                    {result.content}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </Dialog.Content>
    </Dialog>
  );
};
