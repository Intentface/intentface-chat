"use client";
/// <reference types="react/canary" />

import { BookOpen } from "@keyline-icons/react";
// Keyline has no brand or sandbox icons, so these stay on Tabler.
import { IconBrandGithub, IconBrandNpm, IconSandbox } from "@tabler/icons-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { type ReactNode, useEffect, useState, ViewTransition } from "react";
import { ChatNav } from "@/components/chat-nav";
import { DocsNav, type DocsTree, toGroups, toSuggestions } from "@/components/docs/docs-nav";
import { DocsSearch } from "@/components/docs/docs-search";
import { DocsThemeToggle } from "@/components/docs/docs-theme-toggle";
import { LogoTile } from "@/components/icons/logo-tile";
import { IconButton } from "@/components/ui/icon-button";
import { Kbd } from "@/components/ui/kbd";
import { Sidebar } from "@/components/ui/sidebar";
import Tooltip from "@/components/ui/tooltip";
import { useAsRef } from "@/hooks/use-as-ref";
import { cn } from "@/lib/utils";

type Mode = "docs" | "playground";

// Declaration order is slide order: Docs sits left of Playground.
// `key` is the second half of its G-then-key shortcut.
const MODES: { value: Mode; label: string; icon: ReactNode; key: string }[] = [
  { value: "docs", label: "Docs", icon: <BookOpen />, key: "D" },
  { value: "playground", label: "Playground", icon: <IconSandbox />, key: "P" },
];

// The chat routes are the playground; every other page is the docs.
const modeOf = (pathname: string): Mode =>
  pathname === "/playground" || pathname.startsWith("/chat/") ? "playground" : "docs";

// G then D / G then P switch sides, like Linear's go-to sequences: the second
// key has to follow within a second.
const SEQUENCE_MS = 1000;

// Plain-letter shortcuts must never fire while someone is typing.
const isTyping = (target: EventTarget | null) =>
  target instanceof HTMLElement &&
  (target.isContentEditable || target.closest("input, textarea, select") !== null);

const useGoToShortcuts = (go: (mode: Mode) => void) => {
  const goRef = useAsRef(go);

  useEffect(() => {
    let armedAt = 0;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.repeat || event.metaKey || event.ctrlKey || event.altKey)
        return;
      if (isTyping(event.target)) return;
      const key = event.key.toUpperCase();
      const target = MODES.find((mode) => mode.key === key);
      if (target && Date.now() - armedAt < SEQUENCE_MS) {
        event.preventDefault();
        armedAt = 0;
        goRef.current(target.value);
        return;
      }
      armedAt = key === "G" ? Date.now() : 0;
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);
};

/**
 * One shell for the whole site, mounted in the root layout so moving between the
 * docs and the playground keeps the sidebar — its open state and width — and
 * only its body slides over, picked by the icon switch in the header. The
 * collapse button sits in each side's top bar instead. A client component because `Sidebar` is an
 * `Object.assign` compound, which a server component would read as a proxy.
 *
 * It reads no cookie: the docs stay statically rendered, so every full load
 * starts with the sidebar open.
 */
export const SiteShell = ({ tree, children }: { tree: DocsTree; children: ReactNode }) => {
  const pathname = usePathname();
  const mode = modeOf(pathname);
  const groups = toGroups(tree.children);

  // Each side reopens on the page you left it at.
  const [lastPath, setLastPath] = useState<Record<Mode, string>>({
    docs: "/",
    playground: "/playground",
  });
  if (lastPath[mode] !== pathname) setLastPath({ ...lastPath, [mode]: pathname });

  const router = useRouter();
  useGoToShortcuts((next) => {
    if (next !== mode) router.push(lastPath[next]);
  });

  return (
    <Sidebar.Provider>
      <Sidebar>
        {/* Centred on the viewport's top bar: both start 8px down, and the bar
            (52px) sits under the viewport's 1px border, hence 54px. The extra
            height is taken back from the gap below. */}
        <Sidebar.Header className="-mb-2 h-[54px] shrink-0 flex-row items-center justify-between pr-0.5 pl-1">
          <Link
            href="/"
            className="flex items-center gap-2.5 text-ink-primary"
            aria-label="@intentface/chat"
          >
            <LogoTile />
            <span className="font-semibold text-md tracking-[-0.01em]">intentface/chat</span>
          </Link>
          <div className="flex items-center gap-1">
            <DocsSearch suggestions={toSuggestions(groups)} />
            <nav aria-label="Site" className="flex gap-0.5 rounded-full bg-ink-primary/5 p-0.5">
              {MODES.map(({ value, label, icon, key }) => (
                <Tooltip key={value}>
                  <Tooltip.Trigger
                    render={
                      <Link
                        href={lastPath[value]}
                        aria-label={label}
                        aria-current={mode === value ? "true" : undefined}
                        aria-keyshortcuts={`G ${key}`}
                        className={cn(
                          "grid size-6 place-items-center rounded-full transition-[color,background-color,box-shadow] [&>svg]:size-[15px]",
                          "focus-visible:outline-2 focus-visible:outline-accent-bg/60 focus-visible:outline-offset-1",
                          mode === value
                            ? "bg-raised text-ink-primary shadow-raised"
                            : "text-ink-secondary hover:text-ink-primary",
                        )}
                      >
                        {icon}
                      </Link>
                    }
                  />
                  <Tooltip.Content side="bottom" className="flex items-center gap-2">
                    {label}
                    <span className="flex gap-0.5">
                      <Kbd size="sm">G</Kbd>
                      <Kbd size="sm">{key}</Kbd>
                    </span>
                  </Tooltip.Content>
                </Tooltip>
              ))}
            </nav>
          </div>
        </Sidebar.Header>
        <Sidebar.Views value={mode}>
          <Sidebar.View value="docs">
            <DocsNav groups={groups} />
          </Sidebar.View>
          <Sidebar.View value="playground">
            <ChatNav />
          </Sidebar.View>
        </Sidebar.Views>
        {/* Shared by both sides, so it stays put while the views slide. */}
        <Sidebar.Footer className="flex-row items-center justify-end border-ink-primary/8 border-t pt-2 pr-1 pl-0.5">
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
      <Sidebar.Inset>
        <Sidebar.Viewport>
          {/* Keyed by side: switching sides swaps the boundary, so the old and new
              viewport cross-dissolve; pages within a side don't animate. */}
          <ViewTransition key={mode} name="site-viewport" update="none">
            {children}
          </ViewTransition>
        </Sidebar.Viewport>
      </Sidebar.Inset>
    </Sidebar.Provider>
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
