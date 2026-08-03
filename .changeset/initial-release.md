---
"@intentface/chat": minor
---

Initial release: headless chat UI primitives for React, unstyled and animation-free.

Eleven entry points, each a compound component (or a pure utility module) that renders
semantic DOM with `data-*` state attributes and takes a `render` prop for swapping the
underlying element:

- `/composer` — rich-text input over a purpose-built contenteditable engine: inline chips,
  `/` and `@` prefix-triggered command lists with fuzzy scoring, attachments, and the
  ask-user questionnaire flow. One store per `<Composer>`, or bring your own with
  `Composer.createStore()` to drive it from outside the tree.
- `/thread` — scroll container with at-bottom detection, auto-follow, prepend-aware
  restoration, and dock/overlay inset measurement.
- `/message` — message parts, turns, chip-segmented text, sources, actions, and selection.
- `/steps`, `/reasoning` — tool-call timelines and reasoning disclosure.
- `/chip`, `/attachments`, `/ask-user` — the remaining building blocks.
- `/types` — the structural message contract plus part type guards.
- `/message-utils` — part segmentation, turn grouping, and reasoning/source derivation.
- `/chip-markdown` — the self-describing chip wire format.

The types are framework-agnostic: an AI SDK `UIMessage` satisfies `ChatMessage`
structurally, so SDK messages pass straight into the utilities and components with no
adapter. Beyond the React 19 peer, the package pulls in only `@floating-ui/dom` (anchored
positioning) and `nanoid` (attachment ids) — no editor framework and no animation library.

Styling is left entirely to the consumer; copy-paste styled sources and live previews live
at https://intentface.dev/docs.
