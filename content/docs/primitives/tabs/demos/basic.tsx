"use client";

import { Tabs, useTabs } from "@intentface/chat/tabs";
import { File, Plus, X } from "@keyline-icons/react";
import { useState } from "react";
import { type Document, DocumentBody, LOREM, SEEDED } from "./document";
import { TabStrip } from "./tab-strip";

/*
 * Document tabs across the window chrome, with the content in a card beneath.
 *
 * Both the strip and the viewport take a function, so neither needs a map, a
 * key, or a subscription of its own. The viewport is one box, not a panel per
 * tab: switching re-renders the same element rather than mounting a new one.
 * Close the last tab and nothing is open — an ordinary state here, which is
 * why this is a toolbar of disclosures rather than an ARIA tablist.
 */

export const Basic = () => {
  const [documents, setDocuments] = useState(SEEDED);

  return (
    <div className="relative tabs-demo flex h-[32rem] w-full flex-col overflow-hidden rounded-xl bg-[#f5f5f6] shadow-[0_0_0_1px_rgb(0_0_0/0.075),0_1px_2px_rgb(0_0_0/0.06),0_4px_8px_-2px_rgb(0_0_0/0.05)] dark:bg-[#131315] dark:shadow-[0_0_0_1px_rgb(0_0_0/0.16),0_1px_2px_rgb(0_0_0/0.1)] dark:after:pointer-events-none dark:after:absolute dark:after:inset-0 dark:after:z-50 dark:after:rounded-[inherit] dark:after:shadow-[inset_0_1px_0_rgb(255_255_255/0.05),inset_0_0_0_1px_rgb(255_255_255/0.06)]">
      <Tabs.Root
        defaultItems={Object.keys(SEEDED)}
        defaultValue="doc-1"
        selectOnClose="adjacent"
        className="flex min-h-0 flex-1 flex-col"
      >
        {/* The list iterates the collection itself, which leaves no room inside
            it for chrome — so the add button is its sibling, not its child. The
            scroller hugs its content, so the button sits beside the last tab
            until the tabs overflow, then holds the strip's end. */}
        <div className="flex shrink-0 items-center gap-1 p-2">
          <TabStrip>
            <Tabs.List aria-label="Open documents" className="flex items-center gap-1">
              {(id) => (
                <Tabs.Trigger
                  value={id}
                  aria-label={documents[id]?.name ?? id}
                  className={tabClass}
                >
                  <Tabs.Icon className="text-zinc-500 dark:text-zinc-400 [&>svg]:size-[15px] [&>svg]:shrink-0">
                    <File className="size-[15px]" />
                  </Tabs.Icon>
                  <span className="min-w-0 truncate">{documents[id]?.name ?? id}</span>

                  {/* Positioned with a mask, so the label runs *under* it and
                    fades out — even a tab squeezed to a few characters keeps a
                    clean edge instead of colliding with the button. It shows
                    itself on hover and while the tab is open. */}
                  <Tabs.Action
                    className={[
                      // Inset 1px with a matching corner, so the cover never paints over the
                      // tab's ring and top highlight; it inherits the face's gradient too,
                      // not just its colour, so it doesn't read as a flat block.
                      "absolute inset-y-px right-px flex items-center rounded-r-[5px] bg-inherit [background-image:inherit] pr-1.5 pl-3",
                      "[mask-image:linear-gradient(to_right,transparent,#000_0.5rem)]",
                      "opacity-0 transition-opacity group-hover/tab:opacity-100 group-data-[selected]/tab:opacity-100",
                    ].join(" ")}
                  >
                    <Tabs.Close
                      aria-label={`Close ${documents[id]?.name ?? id}`}
                      className="grid size-5 shrink-0 cursor-pointer select-none place-items-center rounded-full text-zinc-400 transition-colors hover:bg-zinc-950/5 hover:text-zinc-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0169cc]/60 dark:text-zinc-500 dark:hover:bg-white/8 dark:hover:text-zinc-100"
                    >
                      <X className="size-3.5" />
                    </Tabs.Close>
                  </Tabs.Action>
                </Tabs.Trigger>
              )}
            </Tabs.List>
          </TabStrip>

          <NewDocument
            onCreate={(id, document) => setDocuments((current) => ({ ...current, [id]: document }))}
          />
        </div>

        {/* Hidden rather than absent when nothing is open, so the card's
            place in the layout is held. */}
        <Tabs.Viewport className="mx-2 mb-2 min-h-0 flex-1 overflow-auto rounded-lg bg-white shadow-[0_0_0_1px_rgb(0_0_0/0.075),0_1px_2px_rgb(0_0_0/0.06),0_4px_8px_-2px_rgb(0_0_0/0.05)] data-[empty]:invisible dark:bg-zinc-900 dark:shadow-[inset_0_1px_0_rgb(255_255_255/0.05),inset_0_0_0_1px_rgb(255_255_255/0.06),0_0_0_1px_rgb(0_0_0/0.16),0_1px_2px_rgb(0_0_0/0.1)]">
          {(id) => <DocumentBody document={documents[id]} />}
        </Tabs.Viewport>
      </Tabs.Root>
    </div>
  );
};

/** `open()` adds the tab and selects it in one move — nothing here cleans up. */
const NewDocument = ({ onCreate }: { onCreate: (id: string, document: Document) => void }) => {
  const open = useTabs((tabs) => tabs.open);
  const [drafts, setDrafts] = useState(0);

  return (
    <button
      type="button"
      aria-label="New document"
      onClick={() => {
        const id = `draft-${drafts + 1}`;
        onCreate(id, {
          name: `Untitled ${drafts + 1}`,
          sections: [{ heading: "Empty", paragraphs: [LOREM.short] }],
        });
        setDrafts((count) => count + 1);
        open(id);
      }}
      className="grid size-7 shrink-0 cursor-pointer select-none place-items-center rounded-full text-zinc-400 transition-colors hover:bg-zinc-950/5 hover:text-zinc-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0169cc]/60 dark:text-zinc-500 dark:hover:bg-white/8 dark:hover:text-zinc-100"
    >
      <Plus className="size-[15px]" />
    </button>
  );
};

/*
 * The selected tab is lifted onto a card. `group/tab` is declared here rather
 * than on the strip, which is what lets `Action` reveal itself on hover without
 * the strip knowing the group's name.
 *
 * `relative` and `overflow-hidden` are both load-bearing: the action positions
 * against this box, and the label has to clip under it.
 */
const tabClass = [
  "group/tab relative flex h-[30px] max-w-56 shrink-0 cursor-pointer select-none items-center gap-1.5 overflow-hidden",
  "rounded-md px-2.5 font-medium text-[13px] text-zinc-700 transition-[background-color,color] duration-200 dark:text-zinc-300",
  // Opaque rather than a translucent wash: the action inherits this colour, and
  // a wash painted twice would show as a darker band behind the ×.
  "hover:bg-[#e9e9ea] dark:hover:bg-[#262628]",
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0169cc]/60",
  // The raised ring is a shadow outside the box, so TabStrip pads the scroller
  // to keep it (and the focus outline) from being clipped.
  "data-[selected]:bg-white data-[selected]:bg-linear-to-b data-[selected]:from-white data-[selected]:to-[#fdfdfd] data-[selected]:text-zinc-900",
  "data-[selected]:shadow-[inset_0_1px_0_#fff,0_0_0_1px_rgb(0_0_0/0.075),0_1px_2px_rgb(0_0_0/0.07),0_2px_6px_-2px_rgb(0_0_0/0.05)]",
  "dark:data-[selected]:bg-[#2d2d30] dark:data-[selected]:from-[#313134] dark:data-[selected]:to-[#2a2a2d] dark:data-[selected]:text-zinc-100",
  "dark:data-[selected]:shadow-[0_0_0_1px_rgb(0_0_0/0.16),0_1px_2px_rgb(0_0_0/0.1)]",
  // The inset ring and top highlight go on an overlay above the content, so the
  // close button's fading cover can't paint over them.
  "dark:data-[selected]:after:pointer-events-none dark:data-[selected]:after:absolute dark:data-[selected]:after:inset-0 dark:data-[selected]:after:rounded-[inherit] dark:data-[selected]:after:shadow-[inset_0_1px_0_rgb(255_255_255/0.1),inset_0_0_0_1px_rgb(255_255_255/0.05)]",
].join(" ");
