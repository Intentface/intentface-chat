"use client";

import {
  AlignLeft,
  ArrowDown,
  ArrowUp,
  CornerDownLeft,
  FileText,
  Hash,
  Search,
} from "@keyline-icons/react";
import { useDocsSearch } from "fumadocs-core/search/client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { type KeyboardEvent, type ReactNode, useEffect, useId, useState } from "react";
import { Dialog } from "@/components/ui/dialog";
import { IconButton } from "@/components/ui/icon-button";
import { Kbd } from "@/components/ui/kbd";
import { cn } from "@/lib/utils";

type SearchResult = {
  id: string;
  url: string;
  type: "page" | "heading" | "text";
  content: string;
  breadcrumbs?: string[];
};

type ResultSection = { label: string; items: SearchResult[] };

/*
 * ⌘K palette over the static Orama index (/api/search). Results arrive flat —
 * a page followed by its matching headings and text — so they are grouped by
 * the page's section, and arrow keys walk the flat order across groups.
 */

// A page opens a section named after its breadcrumb; headings and text follow
// the page they belong to.
const toSections = (results: SearchResult[]): ResultSection[] => {
  const sections: ResultSection[] = [];

  for (const result of results) {
    const last = sections.at(-1);
    const label = result.type === "page" ? (result.breadcrumbs?.at(-1) ?? "Docs") : last?.label;

    if (last && last.label === label) last.items.push(result);
    else sections.push({ label: label ?? "Docs", items: [result] });
  }

  return sections;
};

// Orama marks matches with <mark>; content keeps markdown backticks. Render
// both — never the raw tags.
const Highlighted = ({ content }: { content: string }) => {
  const marked = (text: string, keyPrefix: string) =>
    text.split(/(<mark>.*?<\/mark>)/g).map((part, index) =>
      part.startsWith("<mark>") ? (
        <span key={`${keyPrefix}-${index}`} className="text-accent-bg">
          {part.slice(6, -7)}
        </span>
      ) : (
        part
      ),
    );

  return content.split(/(`[^`]+`)/g).map((part, index) =>
    part.startsWith("`") && part.endsWith("`") && part.length > 1 ? (
      <code key={index} className="font-mono text-[0.9em] text-ink-primary">
        {marked(part.slice(1, -1), String(index))}
      </code>
    ) : (
      marked(part, String(index))
    ),
  );
};

const ResultRow = ({
  result,
  section,
  isActive,
  optionId,
  onActivate,
  onSelect,
}: {
  result: SearchResult;
  section: string;
  isActive: boolean;
  optionId: string;
  onActivate: () => void;
  onSelect: () => void;
}) => {
  const isPage = result.type === "page";

  return (
    <Link
      id={optionId}
      href={result.url}
      role="option"
      aria-selected={isActive}
      tabIndex={-1}
      onClick={onSelect}
      onMouseMove={onActivate}
      // Keep the keyboard selection in view; runs when this row becomes active.
      ref={isActive ? (element) => element?.scrollIntoView({ block: "nearest" }) : undefined}
      className={cn(
        "flex items-center gap-2.5 rounded-[10px] pr-2 outline-none",
        isPage ? "h-11 pl-2" : "h-9 pl-[46px]",
        isActive && "bg-ink-primary/5",
      )}
    >
      {isPage ? (
        <span className="grid size-7 shrink-0 place-items-center rounded-[7px] bg-raised text-ink-body shadow-raised">
          <FileText className="size-[15px]" />
        </span>
      ) : result.type === "heading" ? (
        <Hash className="size-3.5 shrink-0 text-ink-tertiary" />
      ) : (
        <AlignLeft className="size-3.5 shrink-0 text-ink-tertiary" />
      )}
      <span
        className={cn(
          "min-w-0 flex-1 truncate",
          isPage ? "font-medium text-ink-primary text-md" : "text-ink-body text-md",
        )}
      >
        <Highlighted content={result.content} />
      </span>
      {isPage && <span className="shrink-0 text-ink-secondary text-xs">{section}</span>}
      {isActive && (
        <Kbd size="md" square>
          <CornerDownLeft />
        </Kbd>
      )}
    </Link>
  );
};

export type SearchSuggestion = { url: string; title: string };

export const DocsSearch = ({ suggestions = [] }: { suggestions?: SearchSuggestion[] }) => {
  const [open, setOpen] = useState(false);
  // The "fetch" preset queries the /api/search route handler (createFromSource).
  const { search, setSearch, query } = useDocsSearch({ type: "fetch" });
  const router = useRouter();
  const listId = useId();

  // The highlight belongs to the query it was made for; a new query starts at the top.
  const [active, setActive] = useState({ search: "", index: 0 });

  useEffect(() => {
    const onKey = (event: globalThis.KeyboardEvent) => {
      if (event.key === "k" && (event.metaKey || event.ctrlKey)) {
        event.preventDefault();
        setOpen((value) => !value);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // An empty query is primed with the primitives, so the palette never opens blank.
  const results =
    search.length === 0
      ? suggestions.map(
          (suggestion): SearchResult => ({
            id: suggestion.url,
            url: suggestion.url,
            type: "page",
            content: suggestion.title,
            breadcrumbs: ["Primitives"],
          }),
        )
      : Array.isArray(query.data)
        ? (query.data as SearchResult[])
        : [];
  const sections = toSections(results);
  const flat = sections.flatMap((section) =>
    section.items.map((result) => ({ result, section: section.label })),
  );
  const activeIndex = active.search === search ? Math.min(active.index, flat.length - 1) : 0;
  const optionId = (index: number) => `${listId}-option-${index}`;

  const close = () => setOpen(false);

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (flat.length === 0) return;
    switch (event.key) {
      case "ArrowDown":
        event.preventDefault();
        setActive({ search, index: (activeIndex + 1) % flat.length });
        break;
      case "ArrowUp":
        event.preventDefault();
        setActive({ search, index: (activeIndex - 1 + flat.length) % flat.length });
        break;
      case "Enter":
        event.preventDefault();
        router.push(flat[activeIndex].result.url);
        close();
        break;
    }
  };

  let body: ReactNode;
  switch (true) {
    case search.length === 0 && flat.length === 0:
      body = <PaletteNote>Search pages, headings and text.</PaletteNote>;
      break;
    case flat.length === 0 && query.isLoading:
      body = <PaletteNote>Searching…</PaletteNote>;
      break;
    case flat.length === 0:
      body = <PaletteNote>No results for “{search}”.</PaletteNote>;
      break;
    default: {
      let index = -1;
      body = sections.map((section, sectionIndex) => (
        <div
          key={`${section.label}-${sectionIndex}`}
          role="group"
          aria-label={section.label}
          className="flex flex-col gap-px not-first:mt-1.5"
        >
          <div className="flex h-7 items-center px-2.5 font-medium text-ink-secondary text-xs">
            {section.label}
          </div>
          {section.items.map((result) => {
            index += 1;
            const rowIndex = index;
            return (
              <ResultRow
                key={result.id}
                result={result}
                section={section.label}
                optionId={optionId(rowIndex)}
                isActive={rowIndex === activeIndex}
                onActivate={() => setActive({ search, index: rowIndex })}
                onSelect={close}
              />
            );
          })}
        </div>
      ));
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Dialog.Trigger
        render={
          <IconButton
            variant="ghost"
            aria-label="Search docs"
            aria-keyshortcuts="Meta+K Control+K"
            className="size-7 rounded-full"
          >
            <Search />
          </IconButton>
        }
      />
      <Dialog.Content className="top-[12vh] max-w-[640px] translate-y-0 overflow-hidden p-0">
        <Dialog.Title className="sr-only">Search documentation</Dialog.Title>
        <div className="flex h-14 items-center gap-2.5 pr-3.5 pl-[18px]">
          <Search className="size-[18px] shrink-0 text-ink-secondary" />
          <input
            autoFocus
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Search documentation…"
            role="combobox"
            aria-expanded={flat.length > 0}
            aria-controls={listId}
            aria-activedescendant={flat.length > 0 ? optionId(activeIndex) : undefined}
            className="h-full flex-1 bg-transparent text-ink-primary text-xl outline-none placeholder:text-ink-tertiary"
          />
          <Kbd size="md">Esc</Kbd>
        </div>
        <div
          id={listId}
          role="listbox"
          aria-label="Results"
          // scroll-py matches the 32px edge fade, so arrowing keeps the active row clear of it.
          className="scroll-mask-y flex max-h-[min(60vh,26rem)] scroll-py-8 flex-col overflow-y-auto p-2"
        >
          {body}
        </div>
        <div className="flex h-11 items-center gap-4 px-4 text-ink-secondary text-xs shadow-[inset_0_1px_0_color-mix(in_oklab,var(--color-ink-primary)_6%,transparent)]">
          <span className="flex items-center gap-1.5">
            <span className="flex gap-[3px]">
              <Kbd size="md" square>
                <ArrowUp />
              </Kbd>
              <Kbd size="md" square>
                <ArrowDown />
              </Kbd>
            </span>
            Navigate
          </span>
          <span className="flex items-center gap-1.5">
            <Kbd size="md" square>
              <CornerDownLeft />
            </Kbd>
            Open
          </span>
          <span className="flex items-center gap-1.5">
            <Kbd size="md">Esc</Kbd>
            Close
          </span>
        </div>
      </Dialog.Content>
    </Dialog>
  );
};

const PaletteNote = ({ children }: { children: ReactNode }) => (
  <p className="px-3 py-8 text-center text-ink-secondary text-sm">{children}</p>
);
