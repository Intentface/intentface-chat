# @intentface/chat

Headless chat UI primitives for React — the behavior, state, and wire formats
for building AI chat interfaces, with no styling of their own. Pair them with
the shadcn-style styled layer from the [docs](https://intentface.dev/docs), or
bring your own.

This is the Base UI model applied to chat: **install the logic from npm, copy
the look from the docs.**

## Install

```bash
bun add @intentface/chat
```

`react` and `react-dom` (v19+) are peer dependencies. Nothing else ships with
it beyond two small runtime deps (`@floating-ui/dom` for anchored positioning,
`nanoid` for attachment ids) — no editor framework, no animation library.

## What's inside

Each primitive is a separate entry point, exporting an unstyled compound
component that renders semantic DOM with `data-*` state attributes, context
hooks, and a `render` prop for swapping the underlying element:

| Import | What it is |
| --- | --- |
| `@intentface/chat/composer` | Rich-text input over a purpose-built contenteditable engine: `/` and `@` command palette, inline chips, attachments, ask-user flow. One store per `<Composer>`, or bring your own via `Composer.createStore()`. |
| `@intentface/chat/thread` | Scroll container with at-bottom detection and auto-follow. |
| `@intentface/chat/message` | Message parts, turns, chip-segmented text, sources, actions. |
| `@intentface/chat/steps`, `/reasoning` | Tool-call timelines and reasoning disclosure. |
| `@intentface/chat/chip`, `/attachments`, `/ask-user` | The remaining building blocks. |
| `@intentface/chat/types` | The structural message contract + part type guards. |
| `@intentface/chat/message-utils` | Part segmentation, turn grouping, reasoning/source derivation. |
| `@intentface/chat/chip-markdown` | The self-describing chip wire format. |

## AI SDK, structurally

The types are framework-agnostic. A Vercel AI SDK `UIMessage` satisfies
`ChatMessage` structurally, so there's no adapter — pass SDK messages straight
into the utilities and components:

```tsx
import { groupTurns } from "@intentface/chat/message-utils";
import type { UIMessage } from "ai";

const turns = groupTurns(messages); // messages: UIMessage[]
```

## React Server Components

Each primitive is a namespace, and the root is explicit — `Message.Root`, not
`Message`. Server components can reach every part:

```tsx
// A server component — no "use client" needed.
import { Message } from "@intentface/chat/message";

export const Transcript = ({ messages }: { messages: ChatMessage[] }) => (
  <>
    {messages.map((message) => (
      <Message.Root key={message.id} role={message.role}>
        <Message.Text>{text(message)}</Message.Text>
      </Message.Root>
    ))}
  </>
);
```

The parts are still client components — they carry their own `"use client"` — so
interactive props behave the way React requires. Pass an event handler from a
server component and you'll get React's usual error; move that piece into a
client component:

```tsx
"use client";
import { Composer } from "@intentface/chat/composer";

export const Chat = () => (
  <Composer.Root onSubmit={(data) => send(data)}>
    <Composer.Container>
      <Composer.Textarea />
    </Composer.Container>
  </Composer.Root>
);
```

Hooks (`useComposer`, `useThread`, `useReasoning`, …) are client-only, as usual.
The pure modules — `/types`, `/message-utils`, `/chip-markdown` — carry no
directive and import fine anywhere.

## Docs

Full guides, live previews, and copy-paste styled source at
[intentface.dev/docs](https://intentface.dev/docs).

## License

MIT
