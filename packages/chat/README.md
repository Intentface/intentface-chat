# @intentface/chat

Headless chat UI primitives for React — the behavior, state, and wire formats
for building AI chat interfaces, with no styling of their own. Pair them with
the shadcn-style styled layer from the [docs](https://intentface.dev/docs), or
bring your own.

This is the Base UI model applied to chat: **install the logic from npm, copy
the look from the docs.**

## Install

Most people don't install this package directly — the styled components pull it
in for you via the shadcn CLI:

```bash
bunx shadcn@latest add @intentface/composer
```

To build against the headless primitives yourself:

```bash
bun add @intentface/chat
```

`react` and `react-dom` (v19+) are peer dependencies.

## What's inside

Each primitive is a separate entry point, exporting an unstyled compound
component that renders semantic DOM with `data-*` state attributes, context
hooks, and render props — no classes, no animation library:

| Import | What it is |
| --- | --- |
| `@intentface/chat/composer` | Rich-text input: TipTap editor, `/` and `@` command palette, attachments, ask-user flow. Instance-per-`Composer.Provider` with a global-store fallback. |
| `@intentface/chat/thread` | Scroll container with at-bottom detection and auto-follow. |
| `@intentface/chat/message` | Message parts, turns, chip-segmented text, sources, actions. |
| `@intentface/chat/steps`, `/reasoning`, `/step-queue` | Tool-call timelines and reasoning disclosure. |
| `@intentface/chat/chip`, `/attachments`, `/ask-user` | The remaining building blocks. |
| `@intentface/chat/types` | The structural message contract + part type guards. |
| `@intentface/chat/message-utils` | Part segmentation, turn grouping, reasoning/source derivation. |
| `@intentface/chat/chip-markdown` | The self-describing chip wire format. |
| `@intentface/chat/chat-status` | Derives composer panel state from messages + status. |

## AI SDK, structurally

The types are framework-agnostic. A Vercel AI SDK `UIMessage` satisfies
`ChatMessage` structurally, so there's no adapter — pass SDK messages straight
into the utilities and components:

```tsx
import { groupTurns } from "@intentface/chat/message-utils";
import type { UIMessage } from "ai";

const turns = groupTurns(messages); // messages: UIMessage[]
```

## Docs

Full guides, live previews, and copy-paste styled source at
[intentface.dev/docs](https://intentface.dev/docs).

## License

MIT
