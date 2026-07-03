# Token-delivery spike — findings and CLI decision

Date: 2026-07-03. Protocol: emitted the shadcn dist with `REGISTRY_BASE_URL=http://localhost:<port>`, served `public/` statically, and installed into two scratch consumers with `bunx shadcn@latest` (v4.x): (a) bare Next 16.2 + Tailwind v4, (b) the same after `shadcn init` with the default Radix/Nova preset plus stock `button`/`card`.

## Findings

**End-to-end `add <url>/r/composer.json`** — works. The CLI resolves all transitive registry dependencies via the absolute URLs, lands every file at its declared `target` (`components/ai/*`, `components/ui/*`, `components/icons/*`, `lib/*`, `hooks/*`), creates `components.json` on the fly in a bare app, and installs npm dependencies collected across the closure.

**Unpublished `@intentface/chat`** — the CLI hard-fails the entire add at the dependency-install step (`bun add … @intentface/chat` → npm 404); no files are written. Nothing to fix on our side: this resolves itself at first publish. Until then, local/E2E testing needs the dependency stripped from the emitted JSON (the spike did this in the dist only).

**Mechanism A — `cssVars` + `css` fields (as emitted)** — full fidelity in a bare app: `@theme inline` mappings, `@custom-variant dark (&:is(.dark *))`, all 30 `color-mix(… calc(…))` value chains, and the pre-rewritten `@source "../node_modules/streamdown/dist/*.js"` all arrive intact in `app/globals.css`. **Idempotent**: a second `add` produces a byte-identical file. The CLI additionally auto-generates `@theme inline` self-mappings (`--primary: var(--primary)`) for delivered `:root` variables — harmless duplicates of our own theme block.

**Mechanism B — theme as `registry:file` targeting `~/app/intentface.css`** — also works and is trivially idempotent (whole-file overwrite). Requires the documented one-line `@import "./intentface.css";` in the consumer's globals. The `@source` relative path is correct from `app/`.

**Palette collision in a shadcn-init'd app** — the CLI merges both variable sets into the consumer's existing `:root`/`.dark` blocks with **existing-value-wins** semantics: shadcn's `--primary/--secondary/--accent` (oklch) survive, our colliding definitions are dropped, and our non-colliding tokens (`--bg`, `--fg`, `--con`, all `-hover/-active/-border` chains) are appended. Consequence: our derived chains compute from shadcn's bases (e.g. `--primary-hover` derives from near-black instead of white) — components render functional but visibly wrong. It is **not** a "replacement palette" by default; it's the opposite. Escape hatches, in preference order: (1) docs instruct shadcn-styled apps to install the theme via **mechanism B** with the `@import` placed *after* their token block, which makes the Intentface palette win the cascade for the colliding keys; (2) a documented manual override of the three colliding variables.

**File-less `registry:block` bundles** — accepted. `add <url>/r/chat-primitives.json` resolved the dependency-only block and installed all 13 chat primitives (15 files) correctly.

## Gate decision

**The shadcn CLI becomes the sole public install path. The custom `intentface` CLI moves to maintenance mode** (retained only as the internal registry build + closure validator + tests; the `bin` install path is no longer documented). Mechanism A is the default theme delivery (bare apps — the primary audience for the full Intentface look); mechanism B ships as an additional emitted item and is the documented path for apps that already carry a shadcn palette.

## Follow-ups

1. Re-run this spike end-to-end after `@intentface/chat@0.1.0` is published (the dependency hard-fail blocks everything until then).
2. Emit the mechanism-B item (`intentface-theme-file`) from the manifest properly (the spike hand-crafted it).
3. Theming docs page must cover: the three colliding variable names, existing-wins merge semantics, and the mechanism-B import-order recipe.
4. Phase 6 note: `chat-demo` example should be refreshed against the post-split wrappers; composer/message item dependency arrays were already recomputed during extraction.
