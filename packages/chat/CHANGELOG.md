# @intentface/chat

## 0.2.1

### Patch Changes

- [#76](https://github.com/Intentface/intentface-chat/pull/76) [`fd5575b`](https://github.com/Intentface/intentface-chat/commit/fd5575bc745bf8dc6f91177670c1fded75e8b267) Thanks [@rpvilo](https://github.com/rpvilo)! - `Thread` no longer chases the live edge with a smooth scroll while the container around it is being resized. A consumer that animates the thread open — a collapsed pill springing to a panel, a drawer sliding in — saw the transcript land mid-viewport and then visibly scroll to the bottom over the length of the animation. It now lands at the bottom and stays there.

  The follow is driven by a `ResizeObserver` on the content column, which fires for two different things it could not tell apart: a token streaming in, and the viewport itself changing size. The second is not hypothetical for auto-scrolling threads — in every mode that lands at the top (`follow`, `jump`), the last turn reserves a viewport via `--thread-turn-min-height: var(--thread-turn-area)`, and `--thread-turn-area` is derived from the thread root's `clientHeight`. So a container animating its height rewrites that variable each frame, resizing the content column each frame, and each resize was answered with a fresh smooth scroll to a target that had already moved.

  `follow` now compares the scroll viewport's own box against the previous callback's. Streamed content never changes it; a container animating open or a window resize always does. A composer docked over the transcript is out of the scroller's flow, so growing it moves no box and is not covered here. A changed box still pins to the live end — it just does so instantly, which is the whole difference between landing at the bottom and animating toward it. Width is compared alongside height, so a container that expands horizontally and reflows the transcript is covered too.

  The intent-only gating is unchanged: the resize branch is a synchronous `clientWidth` / `clientHeight` read inside the observer callback, not the one-frame-stale at-bottom snapshot that `follow` deliberately avoids consulting. Threads in a static container are unaffected — the viewport box never changes, so every callback takes the existing smooth path.

  `autoScroll="bottom"` never exhibited this, since it is the one mode that sets no reserve.

- [#76](https://github.com/Intentface/intentface-chat/pull/76) [`fd5575b`](https://github.com/Intentface/intentface-chat/commit/fd5575bc745bf8dc6f91177670c1fded75e8b267) Thanks [@rpvilo](https://github.com/rpvilo)! - `Thread` no longer loses a few pixels of scroll position when the composer changes height. Adding or discarding an attachment — anything that grows or shrinks the dock while you are pinned to the bottom — nudged the transcript down by a handful of pixels and never gave them back. Repeated often enough, the thread drifted away from the live edge.

  `useThreadInsets` derives two custom properties from one dock measurement, and they are designed to cancel: the content wrapper pads by `--thread-overlay-bottom-height`, and the same inset is subtracted from `--thread-turn-area`, which the last turn reserves. Their sum is constant, so the scrollable height should never move when the dock resizes.

  It moved anyway, because the write order broke the cancellation. The padding was written first, then `measureTopInset` and `root.clientHeight` were read — both force a synchronous layout. That layout ran with the _new_ padding against the _old_ reserve, so `scrollHeight` dipped for exactly one frame. The browser clamps `scrollTop` to fit shorter content, and clamping is not reversed when the content grows back a frame later, so each dock resize cost a few pixels permanently.

  Every measurement is now read before either property is written, so both land in the same recalculation and no intermediate layout exists to clamp against. Measured across an attachment discard: `--thread-turn-area` climbs 504px → 566px over 23 frames while `scrollTop`, the scroll maximum, and the last turn's on-screen position all hold still. Previously `scrollTop` dropped 5351 → 5345 on the third frame and stayed there.

## 0.2.0

### Minor Changes

- [#69](https://github.com/Intentface/intentface-chat/pull/69) [`0fb9b14`](https://github.com/Intentface/intentface-chat/commit/0fb9b1441158bc7a2270ac1e20565812aa4c972c) Thanks [@rpvilo](https://github.com/rpvilo)! - Disclosure panels (`Steps.Panel`, `Reasoning.Content`) no longer stay pinned to the height they had when they opened. The panel measures its natural height for the transition and then **releases** that measurement once the transition settles, so an open panel tracks content that appears underneath it — a nested disclosure expanding, rows streaming in. Previously the measurement was written on open and never cleared, so any consumer following the documented `height: var(…)` pattern had its content clipped at the open-time height.

  **Breaking:** the measured height is published as `--panel-height` instead of `--collapsible-panel-height`. The old name leaked an internal: `Collapsible` is not a public part, cannot be imported, and appears nowhere in the docs, so a consumer styling `Steps.Panel` had to reach for a variable named after a component they could not see. The variable is now documented on both parts.

  ```diff
   [data-steps-panel] {
     overflow: hidden;
  -  height: var(--collapsible-panel-height);
  +  height: var(--panel-height);
     transition: height 150ms ease-out;
   }
  ```

  Note the value is present only while the open or close transition runs, which is what makes the fallback to `auto` work while open. That is the intended contract, not a gap.

  Two supporting changes, both internal:

  - `useTransitionStatus` is now called with `enableIdleState` and `deferEndingState` enabled. `idle` is the settled-open status the release gates on, and deferring `ending` by a frame leaves one frame where a closing panel is still at its open size — which is where the close has to be measured. Previously the close was measured on the `ending` frame, with the closed styles already applied, so it measured the clamped box.
  - The unmount is now gated on `transitionStatus === "ending"` rather than merely `!open`. With the ending state deferred, the earlier check could call `getAnimations()` before the closed styles landed, find nothing running, and cut the exit animation off. This also affects `Composer.Panel`, the other consumer of the shared transition hook.

  Measurement also neutralizes inline alignment properties for the read and restores them immediately, matching Base UI — inline alignment can distort a scroll-based measurement.

- [#67](https://github.com/Intentface/intentface-chat/pull/67) [`414d132`](https://github.com/Intentface/intentface-chat/commit/414d132c335fd9678a2ef626d45d074ed9464660) Thanks [@rpvilo](https://github.com/rpvilo)! - **Breaking:** `Thread.Root` no longer takes `dockSelector`. The thread now measures the `Thread.Composer` slot (`[data-thread-composer]`) it already renders, instead of querying the composer's internals for a set of dock parts. Dock your composer in the slot and the measurement is automatic:

  ```diff
  -<Thread dockSelector="[data-my-dock]">
  +<Thread>
     <Thread.Viewport>{turns}</Thread.Viewport>
  -  <div data-my-dock>{composer}</div>
  +  <Thread.Composer>{composer}</Thread.Composer>
   </Thread>
  ```

  This is what the documentation already described — `THREAD.md` and the build-a-chat guide both said the thread measured `Thread.Composer`, while the code measured `[data-composer-context-window], [data-composer-container]` and only ever used the bottom-most match as the reference edge. The old default also meant `Composer.ContextWindow` was never reserved for: it sits above `Composer.Container`, so the container won the measurement and the context strip had to fit inside the 32px content gap or content slid underneath it. Docking the whole slot fixes that, because the slot's box covers every in-flow part.

  The rule is now positional rather than configured: anything inside `Thread.Composer` that should not push content up must be out of the slot's flow. `Thread.ScrollButton` and the default portaled `Composer.Panel` already are, so the standard composition is unaffected. An in-flow panel (`Composer.Panel anchor={false}`) now counts as part of the dock and the viewport insets around it, where previously it overlapped the last turn.

### Patch Changes

- [#68](https://github.com/Intentface/intentface-chat/pull/68) [`7be61d3`](https://github.com/Intentface/intentface-chat/commit/7be61d314defd876b06b5be66ab53e44a053dbcd) Thanks [@rpvilo](https://github.com/rpvilo)! - `exports` now points at `./dist` permanently, so the registry metadata matches the tarball. Previously `exports` pointed at `./src/*.ts` in the repo — so the docs app could consume package source with no build step — and a `prepack`/`postpack` pair swapped it to `./dist` for packing. npm builds the packument from `package.json` as it stands _after_ `postpack`, which restored the source paths, so every published version advertised `./src/*.ts` for all 11 subpaths: files the tarball does not ship.

  Consumers were never affected, because Node resolves against the `package.json` inside the tarball, which always carried the correct `./dist` paths. But `npm view @intentface/chat exports` reported paths that do not exist, which reads exactly like a broken publish — and npm was warning that `publishConfig.exports` "will stop working in the next major version of npm", so the mechanism had an expiry date regardless.

  The swap is gone: `scripts/swap-exports.mjs`, the `postpack` hook, and `publishConfig.exports` are all deleted, and `prepack` now just runs the build. The app gets source resolution from the repo instead of from the published exports map — a `paths` entry in `tsconfig.json` and a matching Turbopack `resolveAlias` in `next.config.ts`, both mapping the 11 subpaths to `packages/chat/src`. Verified by building the docs app with `packages/chat/dist` deleted entirely.

  No API change; nothing to migrate.

- [#71](https://github.com/Intentface/intentface-chat/pull/71) [`9a378b5`](https://github.com/Intentface/intentface-chat/commit/9a378b579f5e11ad26f30441e1893dc8f8cec8eb) Thanks [@rpvilo](https://github.com/rpvilo)! - Point `homepage` and the README at `https://ui.intentface.com`. The previous address, `intentface.dev`, does not resolve — so the link on the npm page and the two documentation links inside the shipped README were dead. The documentation now also lives at the root of that host rather than under `/docs`, so the paths lose that prefix.

  No code change; published metadata only.

- [#63](https://github.com/Intentface/intentface-chat/pull/63) [`d73bb3f`](https://github.com/Intentface/intentface-chat/commit/d73bb3f2b587616412a3a5ef09cc888a0eb8c2c1) Thanks [@rpvilo](https://github.com/rpvilo)! - Fix `Composer.Textarea` accumulating phantom newlines during rapid editing. The editor's padding `<br>` is now marked with `data-padding-break` and recognized structurally instead of being inferred from position, so a native edit that strands it mid-document no longer reads it back as real content. The padding also stops consuming a caret position, keeping the DOM's position space aligned with the model's length.

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
