import { Fragment } from "react";

export type Document = { name: string; sections: { heading: string; paragraphs: string[] }[] };

export const LOREM = {
  short:
    "Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.",
  medium:
    "Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur.",
  long: "Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum. Sed ut perspiciatis unde omnis iste natus error sit voluptatem accusantium doloremque laudantium, totam rem aperiam eaque ipsa quae ab illo inventore veritatis et quasi architecto beatae vitae dicta sunt explicabo.",
};

// Different lengths on purpose: switching tabs has to visibly change the
// viewport, since that is the thing being demonstrated.
export const SEEDED: Record<string, Document> = {
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

// Left-aligned with a deep left pad, not centred — centring in a wide card
// pushes the prose into the middle and leaves it looking adrift.
export const DocumentBody = ({ document }: { document: Document | undefined }) => {
  if (!document) return null;

  return (
    <article className="max-w-2xl px-10 py-8">
      <h1 className="mb-5 text-balance font-semibold text-base text-zinc-900 leading-snug tracking-tight dark:text-zinc-100">
        {document.name}
      </h1>
      {document.sections.map((section) => (
        <Fragment key={section.heading}>
          <h2 className="mt-6 mb-1.5 font-semibold text-sm text-zinc-900 tracking-tight dark:text-zinc-100">
            {section.heading}
          </h2>
          {section.paragraphs.map((paragraph) => (
            <p
              key={paragraph}
              className="mb-4 text-sm text-zinc-700 leading-[1.7] dark:text-zinc-300"
            >
              {paragraph}
            </p>
          ))}
        </Fragment>
      ))}
    </article>
  );
};
