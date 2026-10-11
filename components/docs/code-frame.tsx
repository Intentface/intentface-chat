"use client";

import { Tabs } from "@base-ui/react/tabs";
import { Check, Copy } from "@keyline-icons/react";
import type { ReactNode } from "react";
import { useCopy } from "@/hooks/use-copy";
import { cn } from "@/lib/utils";

/**
 * The dark code chrome shared by every block in the docs: a header of file (or
 * package-manager) tabs with a copy button, over an inset code panel. Dark in
 * both themes, tinted by the theme's seeds (see --code-bg in globals.css).
 * A tabbed frame sits inside a `Tabs.Root`, with a `CodeTabList` as its
 * `tabs` and a `CodePanel` per tab as its children.
 */
export const CodeFrame = ({
  tabs,
  code,
  className,
  children,
}: {
  tabs: ReactNode;
  /** What the copy button copies. */
  code: string;
  className?: string;
  children: ReactNode;
}) => (
  <div
    data-code-block=""
    className={cn(
      "not-prose flex flex-col rounded-xl bg-code-bg px-1.5 pb-1.5 shadow-code",
      className,
    )}
  >
    <div className="flex h-10 shrink-0 items-center justify-between gap-2">
      <div className="flex h-full min-w-0 items-center overflow-x-auto">{tabs}</div>
      <CodeCopyButton code={code} />
    </div>
    <div className="overflow-hidden rounded-md bg-code-panel shadow-[inset_0_0_0_1px_rgb(255_255_255/0.07)]">
      {children}
    </div>
  </div>
);

/** The header's tab strip. The indicator slides to the active tab's label. */
export const CodeTabList = ({ children }: { children: ReactNode }) => (
  <Tabs.List className="relative flex h-full items-center">
    {children}
    <Tabs.Indicator
      renderBeforeHydration
      className={cn(
        "absolute bottom-0 left-0 h-0.5 rounded-t-full bg-white/92",
        // Inset 8px into the label on each side.
        "w-[calc(var(--active-tab-width)-32px)] translate-x-[calc(var(--active-tab-left)+16px)]",
        "transition-[translate,width] duration-200 ease-out motion-reduce:transition-none",
      )}
    />
  </Tabs.List>
);

/** A header tab, inside a `CodeTabList`. */
export const CodeTab = ({ value, children }: { value: string; children: ReactNode }) => (
  <Tabs.Tab
    value={value}
    className={cn(
      tabLabel,
      "isolate cursor-pointer text-white/50 outline-none hover:text-white/80 data-active:text-white/92",
      // A centred rounded square behind the label on hover or keyboard focus.
      "before:absolute before:inset-x-0 before:inset-y-1.5 before:-z-10 before:rounded-md before:transition-colors",
      "not-data-active:hover:before:bg-white/8 focus-visible:before:bg-white/8",
    )}
  >
    {children}
  </Tabs.Tab>
);

/** One tab's code, as a child of a tabbed `CodeFrame`. */
export const CodePanel = ({ value, children }: { value: string; children: ReactNode }) => (
  <Tabs.Panel
    value={value}
    className="rounded-md focus-visible:outline-2 focus-visible:outline-white/60 focus-visible:-outline-offset-2"
  >
    {children}
  </Tabs.Panel>
);

/** A plain header label in place of tabs: a single file's name, or dimmed, its language. */
export const CodeTitle = ({
  active = true,
  children,
}: {
  active?: boolean;
  children: ReactNode;
}) => (
  <span
    className={cn(
      tabLabel,
      active
        ? "text-white/92 after:absolute after:inset-x-4 after:bottom-0 after:h-0.5 after:rounded-t-full after:bg-white/92"
        : "text-white/50",
    )}
  >
    {children}
  </span>
);

const tabLabel =
  "relative flex h-full shrink-0 items-center px-2 font-medium font-mono text-xs transition-colors";

const CodeCopyButton = ({ code }: { code: string }) => {
  const { copy, copied } = useCopy();
  const isCopied = copied === code;

  return (
    <button
      type="button"
      onClick={() => copy(code)}
      aria-label={isCopied ? "Copied" : "Copy code"}
      className="grid size-7 shrink-0 cursor-pointer place-items-center rounded-md text-white/56 transition-colors hover:bg-white/8 hover:text-white focus-visible:outline-2 focus-visible:outline-white/60"
    >
      {isCopied ? <Check className="size-[15px]" /> : <Copy className="size-[15px]" />}
    </button>
  );
};
