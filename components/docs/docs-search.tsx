"use client";

import { IconSearch } from "@tabler/icons-react";
import { useDocsSearch } from "fumadocs-core/search/client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Dialog } from "@/components/ui/dialog";
import { IconButton } from "@/components/ui/icon-button";
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
        render={
          <IconButton
            variant="primary"
            size="md"
            aria-label="Search docs (⌘K)"
            className="rounded-full"
          >
            <IconSearch />
          </IconButton>
        }
      />
      <Dialog.Content className="top-24 max-w-lg translate-y-0 p-0">
        <Dialog.Title className="sr-only">Search documentation</Dialog.Title>
        <div className="flex items-center gap-2 border-secondary-border border-b px-4">
          <IconSearch className="size-4 shrink-0 text-ink-tertiary" />
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
                      "block rounded-md px-3 py-2 text-sm transition-colors hover:bg-secondary-bg-hover",
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
