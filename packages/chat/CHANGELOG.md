# @intentface/chat

## 0.1.2

### Patch Changes

- [#65](https://github.com/Intentface/intentface-chat/pull/65) [`987e276`](https://github.com/Intentface/intentface-chat/commit/987e2766e08df78049bdd4575c35b5e05d16f6f7) Thanks [@valstu](https://github.com/valstu)! - Add the missing `.js` extensions to single-quoted specifiers in `dist`, which
  made the package unloadable under SSR.

  `add-dist-extensions` matched only double-quoted specifiers. The vendored files
  under `src/internal/render` came from Base UI's source and use single quotes, so
  21 of their relative specifiers (13 in `.js`, 8 in `.d.ts`) shipped
  extensionless. Bundlers resolve those, which is why the browser was fine; Node's
  ESM resolver requires fully-specified paths and threw
  `Cannot find module .../internal/render/useMergedRefs` on the first import. Every
  part goes through `useRenderElement`, so importing _any_ entry point on a server
  failed — a Next or TanStack Start app rendered nothing server-side and silently
  fell back to client rendering.

  The pattern now captures the quote character and backreferences it, so both
  styles are rewritten and the quote is preserved.

  The build now ends with a smoke test that imports every subpath in
  `publishConfig.exports` under Node — the entire consumer-reachable surface. The
  failure was a resolution error the rewrite script could not see (its own pattern
  was the blind spot) and publint does not resolve the internal graph, so the guard
  tests resolution itself: against the previous rewrite, 8 of the 11 entries fail
  to load; the next regression breaks the build instead of a consumer's server.

## 0.1.1

### Patch Changes

- [#58](https://github.com/Intentface/intentface-chat/pull/58) [`9f74772`](https://github.com/Intentface/intentface-chat/commit/9f747721d26299de9a15f7983e875ec9c8df3ad3) Thanks [@rpvilo](https://github.com/rpvilo)! - Fix two quadratic-backtracking regexes that could hang the browser.

  `parseChipSegments` is the serious one, because message text is untrusted — it
  arrives from the model. The chip token pattern had two independent blowups. A long
  run of `[` with no closing bracket made the label group consume to end-of-string,
  fail, backtrack over every position, advance one character and repeat: 355ms at
  32k characters. Worse, `[a](chip:x:` repeated with no `)` anywhere did the same
  through the value group from many start positions at once: 264ms at 88k
  characters. Both grow quadratically, so a large message could hang a tab for
  seconds.

  Every character class now excludes `[`, so no group can consume past the next
  one and the work per start position is bounded by the gap to it. Safe for
  anything `encodeChipMarkdown` produces — values are `encodeURIComponent`-escaped,
  queries come from `URLSearchParams`, prefixes are short identifiers — and labels
  containing raw brackets never parsed under the previous pattern either.

  `detectActivePrefix` had the same shape via `/\S*$/`, which retries from every
  position when the text ends in whitespace. It runs on every keystroke, so pasting
  a large single-token blob froze the editor — 16 seconds for a 200k-character run.
  Replaced with a backwards index scan, which is linear, allocation-free, and
  returns identical results.

  Both are covered by regression tests asserting a time budget that the previous
  implementations exceeded by two orders of magnitude.

## 0.1.0

### Minor Changes

- [#19](https://github.com/Intentface/intentface-chat/pull/19) [`563a527`](https://github.com/Intentface/intentface-chat/commit/563a5270f4bddedc1dd495da1af03925851c4d6d) Thanks [@rpvilo](https://github.com/rpvilo)! - Initial release: headless chat UI primitives for React, unstyled and animation-free.

  Eleven entry points. Each component entry exports a namespace whose parts you compose
  yourself — `Composer.Root`, `Composer.Container`, `Message.Root`, `Message.Text` — rendering
  semantic DOM with `data-*` state attributes, and every part takes a `render` prop for
  swapping the underlying element:

  - `/composer` — rich-text input over a purpose-built contenteditable engine: inline chips,
    `/` and `@` prefix-triggered command lists with fuzzy scoring, attachments, and the
    ask-user questionnaire flow. One store per `<Composer.Root>`, or bring your own with
    `Composer.createStore()` to drive it from outside the tree.
  - `/thread` — scroll container with at-bottom detection, auto-follow, prepend-aware
    restoration, and dock/overlay inset measurement.
  - `/message` — message parts, turns, chip-segmented text, sources, actions, and selection.
  - `/steps`, `/reasoning` — tool-call timelines and reasoning disclosure.
  - `/chip`, `/attachments`, `/ask-user` — the remaining building blocks.
  - `/types` — the structural message contract plus part type guards.
  - `/message-utils` — part segmentation, turn grouping, and reasoning/source derivation.
  - `/chip-markdown` — the self-describing chip wire format.

  Works with React Server Components. The package ships one module per part, so a server
  component can render a static transcript directly — `Message.Root`, `Message.Text`,
  `Chip.Root` and friends resolve across the client boundary rather than coming back
  `undefined`. The parts remain client components, so hooks and event handlers behave as
  usual; reach for `"use client"` where you need them.

  The types are framework-agnostic: an AI SDK `UIMessage` satisfies `ChatMessage`
  structurally, so SDK messages pass straight into the utilities and components with no
  adapter. Beyond the React 19 peer, the package pulls in only `@floating-ui/dom` (anchored
  positioning) and `nanoid` (attachment ids) — no editor framework and no animation library.

  Styling is left entirely to the consumer; copy-paste styled sources and live previews live
  at https://intentface.dev/docs.
