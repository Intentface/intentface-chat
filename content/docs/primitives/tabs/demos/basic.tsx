"use client";

import { Tabs, useTabs } from "@intentface/chat/tabs";
import { type ComponentProps, Fragment, type ReactNode, useEffect, useRef, useState } from "react";

/*
 * Document tabs across the window chrome, with the content in a card beneath.
 *
 * Both the strip and the viewport take a function, so neither needs a map, a
 * key, or a subscription of its own. The viewport is one box, not a panel per
 * tab: switching re-renders the same element rather than mounting a new one.
 * Close the last tab and nothing is open — an ordinary state here, which is
 * why this is a toolbar of disclosures rather than an ARIA tablist.
 */

type Document = { name: string; sections: { heading: string; paragraphs: string[] }[] };

const LOREM = {
  short:
    "Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.",
  medium:
    "Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur.",
  long: "Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum. Sed ut perspiciatis unde omnis iste natus error sit voluptatem accusantium doloremque laudantium, totam rem aperiam eaque ipsa quae ab illo inventore veritatis et quasi architecto beatae vitae dicta sunt explicabo.",
};

// Different lengths on purpose: switching tabs has to visibly change the
// viewport, since that is the thing being demonstrated.
const SEEDED: Record<string, Document> = {
  "doc-1": {
    name: "Getting started",
    sections: [
      { heading: "Overview", paragraphs: [LOREM.short, LOREM.medium] },
      { heading: "Before you begin", paragraphs: [LOREM.long] },
    ],
  },
  "doc-2": {
    name: "Installation",
    sections: [
      { heading: "Package manager", paragraphs: [LOREM.medium] },
      { heading: "Peer dependencies", paragraphs: [LOREM.short, LOREM.long] },
    ],
  },
  "doc-3": {
    name: "Design tokens",
    sections: [
      { heading: "Surfaces", paragraphs: [LOREM.long, LOREM.short] },
      { heading: "State", paragraphs: [LOREM.medium] },
      { heading: "Typography", paragraphs: [LOREM.short] },
    ],
  },
  "doc-4": {
    name: "Accessibility",
    sections: [{ heading: "Roles", paragraphs: [LOREM.medium] }],
  },
};

export const Basic = () => {
  const [documents, setDocuments] = useState(SEEDED);

  return (
    <div className="tabs-demo flex h-[32rem] w-full flex-col overflow-hidden rounded-xl border border-[#f0f0f0] bg-[#fafafa] dark:border-[#262626] dark:bg-[#111111]">
      <ScrollMask />
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
                  <Tabs.Icon className="[&>svg]:size-4 [&>svg]:shrink-0 [&>svg]:opacity-60">
                    <FileIcon />
                  </Tabs.Icon>
                  <span className="min-w-0 truncate">{documents[id]?.name ?? id}</span>

                  {/* Positioned with a mask, so the label runs *under* it and
                    fades out — even a tab squeezed to a few characters keeps a
                    clean edge instead of colliding with the button. It shows
                    itself on hover and while the tab is open. */}
                  <Tabs.Action
                    className={[
                      "absolute inset-y-0 right-0 flex items-center bg-inherit pr-1.5 pl-3",
                      "[mask-image:linear-gradient(to_right,transparent,#000_0.5rem)]",
                      "opacity-0 transition-opacity group-hover/tab:opacity-100 group-data-[selected]/tab:opacity-100",
                    ].join(" ")}
                  >
                    <Tabs.Close
                      aria-label={`Close ${documents[id]?.name ?? id}`}
                      className="grid size-5 shrink-0 cursor-pointer select-none place-items-center rounded-md text-[#686868] transition-colors hover:bg-[#e4e4e4] hover:text-[#1a1a1a] dark:text-[#9b9b9b] dark:hover:bg-[#333333] dark:hover:text-[#fcfcfc]"
                    >
                      <CloseIcon />
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
        <Tabs.Viewport className="mx-2 mb-2 min-h-0 flex-1 overflow-auto rounded-md border border-[#f0f0f0] bg-white data-[empty]:invisible dark:border-[#262626] dark:bg-[#181818]">
          {(id) => <DocumentBody document={documents[id]} />}
        </Tabs.Viewport>
      </Tabs.Root>
    </div>
  );
};

/*
 * The scrolling half of the strip. Its edges fade only where tabs are hidden
 * behind them — see ScrollMask below — and the open tab is brought into view
 * whenever the selection moves, since a tab added at the end would otherwise
 * open off-screen.
 */
const TabStrip = ({ children }: { children: ReactNode }) => {
  const ref = useRef<HTMLDivElement | null>(null);
  const value = useTabs((tabs) => tabs.value);

  // biome-ignore lint/correctness/useExhaustiveDependencies: `value` is the trigger, not an input — the open tab is found off the DOM, and this has to re-run whenever the selection moves.
  useEffect(() => {
    ref.current
      ?.querySelector("[data-tabs-trigger][data-selected]")
      ?.scrollIntoView({ block: "nearest", inline: "nearest" });
  }, [value]);

  return (
    <div
      ref={ref}
      className="scroll-mask-x min-w-0 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
    >
      {children}
    </div>
  );
};

/*
 * Scroll-position-driven edge fades, with no JavaScript: a scroll timeline
 * animates two registered custom properties, and those feed the mask. At the
 * start the left mask is fully opaque; from 10% in, it fades. The right mask
 * does the reverse. Unsupported browsers get hard edges, which is fine.
 * After https://twilson.net/scroll-mask.
 */
const ScrollMask = () => (
  <style>{`
@property --tabs-demo-mask-l { syntax: "<length-percentage>"; inherits: false; initial-value: 100%; }
@property --tabs-demo-mask-r { syntax: "<length-percentage>"; inherits: false; initial-value: 100%; }

@keyframes tabs-demo-scroll-mask {
  0% { --tabs-demo-mask-l: 100%; }
  10%, 100% { --tabs-demo-mask-l: var(--tabs-demo-fade-from); }
  0%, 90% { --tabs-demo-mask-r: var(--tabs-demo-fade-from); }
  100% { --tabs-demo-mask-r: 100%; }
}

@supports (animation-timeline: scroll()) {
  .tabs-demo .scroll-mask-x {
    --tabs-demo-fade-from: calc(100% - 1.5rem);
    mask-image:
      linear-gradient(to left, black, black var(--tabs-demo-mask-l), transparent),
      linear-gradient(to right, black, black var(--tabs-demo-mask-r), transparent);
    mask-composite: intersect;
    -webkit-mask-composite: source-in;
    animation: tabs-demo-scroll-mask linear;
    animation-timeline: scroll(self inline);
  }
}
`}</style>
);

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
      className="grid size-7 shrink-0 cursor-pointer select-none place-items-center rounded-md text-[#686868] transition-colors hover:bg-[#f4f4f4] hover:text-[#1a1a1a] focus-visible:-outline-offset-2 focus-visible:outline-2 focus-visible:outline-[#1a1a1a] dark:text-[#9b9b9b] dark:hover:bg-[#232323] dark:hover:text-[#fcfcfc] dark:focus-visible:outline-[#fcfcfc]"
    >
      <PlusIcon />
    </button>
  );
};

// Left-aligned with a deep left pad, not centred — centring in a wide card
// pushes the prose into the middle and leaves it looking adrift.
const DocumentBody = ({ document }: { document: Document | undefined }) => {
  if (!document) return null;

  return (
    <article className="max-w-2xl px-10 py-8">
      <h1 className="mb-6 text-balance font-semibold text-[#1a1a1a] text-2xl leading-[1.2] tracking-tight dark:text-[#fcfcfc]">
        {document.name}
      </h1>
      {document.sections.map((section) => (
        <Fragment key={section.heading}>
          <h2 className="mt-7 mb-2 font-semibold text-[#1a1a1a] text-base tracking-tight dark:text-[#fcfcfc]">
            {section.heading}
          </h2>
          {section.paragraphs.map((paragraph) => (
            <p
              key={paragraph}
              className="mb-4 text-[#686868] text-sm leading-[1.7] dark:text-[#9b9b9b]"
            >
              {paragraph}
            </p>
          ))}
        </Fragment>
      ))}
    </article>
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
  "group/tab relative flex h-7 max-w-56 shrink-0 cursor-pointer select-none items-center gap-1.5 overflow-hidden",
  "rounded-md px-2.5 text-[#686868] text-sm transition-[background-color,color] duration-200 dark:text-[#9b9b9b]",
  "hover:bg-[#f4f4f4] dark:hover:bg-[#232323]",
  "focus-visible:-outline-offset-2 focus-visible:outline-2 focus-visible:outline-[#1a1a1a] dark:focus-visible:outline-[#fcfcfc]",
  // A real border, transparent until selected. A shadow ring would sit outside
  // the box, and the scroller clips anything past its content height.
  "border border-transparent data-[selected]:border-[#f0f0f0] data-[selected]:bg-white data-[selected]:text-[#1a1a1a]",
  "dark:data-[selected]:border-[#262626] dark:data-[selected]:bg-[#181818] dark:data-[selected]:text-[#fcfcfc]",
].join(" ");

const FileIcon = (props: ComponentProps<"svg">) => (
  <svg
    viewBox="0 0 16 16"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.3"
    aria-hidden="true"
    {...props}
  >
    <path d="M4 2h5l3 3v9H4V2Z" strokeLinejoin="round" />
    <path d="M9 2v3h3" strokeLinejoin="round" />
  </svg>
);

const PlusIcon = (props: ComponentProps<"svg">) => (
  <svg
    viewBox="0 0 16 16"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.5"
    strokeLinecap="round"
    className="size-4"
    aria-hidden="true"
    {...props}
  >
    <path d="M8 3v10M3 8h10" />
  </svg>
);

const CloseIcon = (props: ComponentProps<"svg">) => (
  <svg
    viewBox="0 0 16 16"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.5"
    strokeLinecap="round"
    className="size-3"
    aria-hidden="true"
    {...props}
  >
    <path d="m4.5 4.5 7 7M11.5 4.5l-7 7" />
  </svg>
);
