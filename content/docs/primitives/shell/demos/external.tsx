"use client";

import { Shell, type ShellStore, useShellStore } from "@intentface/chat/shell";
import { useEffect, useState } from "react";

/*
 * Driving the shell from outside its tree, and binding a key to it.
 *
 * `Shell.createStore()` is the handle. Pass it to the Root and the primitive
 * uses it instead of making its own, which means anything holding the same
 * handle can read and drive the state — including the button under the shell,
 * which is a sibling of the Root rather than a descendant, and so could never
 * have reached it through context.
 *
 * The store is created inside `useState` so it survives re-renders. Creating
 * it during render would hand the Root a different store every time.
 */
export const External = () => {
  const [store] = useState(() => Shell.createStore());
  // The element the shortcut is scoped to. A real app binds the key for the
  // whole window and needs no such ref; this one shares a page with other
  // demos and with the docs' own search field.
  const [host, setHost] = useState<HTMLDivElement | null>(null);

  return (
    <div ref={setHost} className="flex w-full flex-col gap-3">
      <Shortcut store={store} host={host} />

      <Shell.Root
        store={store}
        defaultOpen
        className="group/shell relative flex h-96 w-full overflow-hidden rounded-xl bg-[#f5f5f6] shadow-[0_0_0_1px_rgb(0_0_0/0.075),0_1px_2px_rgb(0_0_0/0.06),0_4px_8px_-2px_rgb(0_0_0/0.05)] [--shell-sidebar-width:200px] dark:bg-[#131315] dark:shadow-[0_0_0_1px_rgb(0_0_0/0.16),0_1px_2px_rgb(0_0_0/0.1)] dark:after:pointer-events-none dark:after:absolute dark:after:inset-0 dark:after:z-50 dark:after:rounded-[inherit] dark:after:shadow-[inset_0_1px_0_rgb(255_255_255/0.05),inset_0_0_0_1px_rgb(255_255_255/0.06)]"
      >
        <div
          data-slot="shell-gutter"
          className="w-(--shell-sidebar-width) shrink-0 transition-[width] duration-150 ease-linear group-data-[state=collapsed]/shell:w-0"
        />

        <Shell.Sidebar className="absolute inset-y-0 left-0 z-10 flex w-(--shell-sidebar-width) flex-col overflow-hidden bg-[#f5f5f6] transition-[left] duration-150 ease-linear data-[state=collapsed]:-left-(--shell-sidebar-width) dark:bg-[#131315]">
          <div className="flex h-11 shrink-0 items-center px-4 font-medium text-[13px] text-zinc-900 dark:text-zinc-100">
            Workspace
          </div>
          <div className="flex flex-col gap-0.5 px-2">
            {/* The first row stands in for the current page. */}
            {["Overview", "Inbox", "Projects"].map((label) => (
              <div
                key={label}
                className="flex h-[30px] items-center rounded-md px-2 font-medium text-[13px] text-zinc-700 transition-colors hover:bg-zinc-950/5 hover:text-zinc-900 first:bg-white first:bg-linear-to-b first:from-white first:to-[#fdfdfd] first:text-zinc-900 first:shadow-[inset_0_1px_0_#fff,0_0_0_1px_rgb(0_0_0/0.075),0_1px_2px_rgb(0_0_0/0.07),0_2px_6px_-2px_rgb(0_0_0/0.05)] dark:text-zinc-300 dark:hover:bg-white/8 dark:hover:text-zinc-100 dark:first:bg-[#2d2d30] dark:first:from-[#29292c] dark:first:to-[#242427] dark:first:text-zinc-100 dark:first:shadow-[inset_0_1px_0_rgb(255_255_255/0.1),inset_0_0_0_1px_rgb(255_255_255/0.05),0_0_0_1px_rgb(0_0_0/0.16),0_1px_2px_rgb(0_0_0/0.1)]"
              >
                {label}
              </div>
            ))}
          </div>
        </Shell.Sidebar>

        <Shell.Viewport className="flex min-w-0 flex-1 flex-col p-2">
          <div className="flex min-h-0 flex-1 items-center justify-center rounded-lg bg-white shadow-[0_0_0_1px_rgb(0_0_0/0.075),0_1px_2px_rgb(0_0_0/0.06),0_4px_8px_-2px_rgb(0_0_0/0.05)] text-[13px] text-zinc-500 dark:bg-zinc-900 dark:shadow-[inset_0_1px_0_rgb(255_255_255/0.05),inset_0_0_0_1px_rgb(255_255_255/0.06),0_0_0_1px_rgb(0_0_0/0.16),0_1px_2px_rgb(0_0_0/0.1)] dark:text-zinc-400">
            Content
          </div>
        </Shell.Viewport>
      </Shell.Root>

      {/* Outside Shell.Root entirely — it reaches the state through the store
          handle, not through context. */}
      <ExternalTrigger store={store} />
    </div>
  );
};

/**
 * A sibling of the Root, not a child. It reads the same state the sidebar
 * renders from, and calls the same action the built-in trigger would.
 */
const ExternalTrigger = ({ store }: { store: ShellStore }) => {
  const open = useShellStore(store, (shell) => shell.open);

  return (
    <div className="flex justify-center">
      <button
        type="button"
        onClick={() => store.getSnapshot().toggle()}
        className="flex h-8 cursor-pointer items-center rounded-full bg-white bg-linear-to-b from-white to-[#fdfdfd] shadow-[inset_0_1px_0_#fff,0_0_0_1px_rgb(0_0_0/0.075),0_1px_2px_rgb(0_0_0/0.07),0_2px_6px_-2px_rgb(0_0_0/0.05)] px-4 font-medium text-[13px] text-zinc-900 hover:from-[#fafafa] hover:to-[#f6f6f6] focus-visible:outline-2 focus-visible:outline-[#0169cc]/60 focus-visible:outline-offset-2 dark:bg-[#2d2d30] dark:from-[#313134] dark:to-[#2a2a2d] dark:shadow-[inset_0_1px_0_rgb(255_255_255/0.1),inset_0_0_0_1px_rgb(255_255_255/0.05),0_0_0_1px_rgb(0_0_0/0.16),0_1px_2px_rgb(0_0_0/0.1)] dark:hover:from-[#38383b] dark:hover:to-[#313134] dark:text-zinc-100"
      >
        {open ? "Collapse" : "Expand"}
      </button>
    </div>
  );
};

/**
 * The package binds no global keys, because it cannot know which combinations
 * the surrounding app has already spent. Binding one is a few lines, and
 * `toggle` is all it needs — a floated-out sidebar is pinned open rather than
 * closed. Press Cmd/Ctrl + B with the pointer over this demo.
 *
 * The `host` test is this page's problem, not yours: a docs page carries many
 * demos and a search field, so a bare window listener here would swallow
 * Cmd/Ctrl + B everywhere on it. An app binding its own shortcut drops the
 * check and keeps the rest.
 */
const Shortcut = ({ store, host }: { store: ShellStore; host: HTMLElement | null }) => {
  useEffect(() => {
    if (!host) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "b" || !(event.metaKey || event.ctrlKey)) return;
      if (!host.matches(":hover") && !host.contains(document.activeElement)) return;
      event.preventDefault();
      store.getSnapshot().toggle();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [store, host]);

  return null;
};
