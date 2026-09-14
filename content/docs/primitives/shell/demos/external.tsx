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

  return (
    <div className="flex w-full flex-col gap-3">
      <Shortcut store={store} />

      <Shell.Root
        store={store}
        defaultOpen
        className="group/shell relative flex h-96 w-full overflow-hidden rounded-xl border border-[#f0f0f0] bg-[#fafafa] [--shell-sidebar-width:200px] dark:border-[#262626] dark:bg-[#111111]"
      >
        <div
          data-slot="shell-gutter"
          className="w-(--shell-sidebar-width) shrink-0 transition-[width] duration-150 ease-linear group-data-[state=collapsed]/shell:w-0"
        />

        <Shell.Sidebar className="absolute inset-y-0 left-0 z-10 flex w-(--shell-sidebar-width) flex-col overflow-hidden bg-[#fafafa] transition-[left] duration-150 ease-linear data-[state=collapsed]:-left-(--shell-sidebar-width) dark:bg-[#111111]">
          <div className="flex h-11 shrink-0 items-center px-4 font-medium text-[#1a1a1a] text-sm dark:text-[#fcfcfc]">
            Workspace
          </div>
          <div className="flex flex-col gap-0.5 px-2">
            {["Overview", "Inbox", "Projects"].map((label) => (
              <div
                key={label}
                className="flex h-8 items-center rounded-md px-2 text-[#686868] text-sm dark:text-[#9b9b9b]"
              >
                {label}
              </div>
            ))}
          </div>
        </Shell.Sidebar>

        <Shell.Viewport className="flex min-w-0 flex-1 flex-col p-2">
          <div className="flex min-h-0 flex-1 items-center justify-center rounded-xl border border-[#f0f0f0] bg-white text-[#686868] text-sm dark:border-[#262626] dark:bg-[#181818] dark:text-[#9b9b9b]">
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
        className="flex h-8 cursor-pointer items-center rounded-full border border-[#e4e4e4] bg-white px-4 font-medium text-[#1a1a1a] text-sm transition-colors hover:bg-[#f4f4f4] focus-visible:-outline-offset-2 focus-visible:outline-2 focus-visible:outline-[#1a1a1a] dark:border-[#2d2d2d] dark:bg-[#181818] dark:text-[#fcfcfc] dark:hover:bg-[#232323] dark:focus-visible:outline-[#fcfcfc]"
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
 */
const Shortcut = ({ store }: { store: ShellStore }) => {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "b" || !(event.metaKey || event.ctrlKey)) return;
      event.preventDefault();
      store.getSnapshot().toggle();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [store]);

  return null;
};
