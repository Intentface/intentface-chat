---
"@intentface/chat": minor
---

Generative UI, as two new entries.

**`@intentface/chat/genui`** is the headless core, with no React and no DOM, so a server can import it. It contains:

- The default catalog of ten elements (`Card`, `Stack`, `Grid`, `Heading`, `Text`, `Metric`, `KeyValue`, `DataTable`, `Chart`, `Callout`) and six views (`table`, `chart`, `metrics`, `record`, `email`, `steps`). Each entry has its zod schemas.
- `defineCatalog` to extend or narrow it, with configurable limits.
- Spec schemas in the three forms: model input (a list), canonical (stored, keyed by id, versioned as `v`), and resolved.
- `canonicalSpec` for model input, and `readStoredSpec` and `migrateSpec` for specs kept across catalog versions.
- `checkSpec`, which checks the tree rules a schema can't state.
- `readSpec` for streaming input.
- `$data` bindings with an opaque ref, and `withData` to swap values in.
- The Markdown export.

Every catalog entry must provide `toMarkdown(props, { children, title, locale, timeZone })`. `toMarkdown`, `viewToMarkdown`, `exportSpec` and `exportView` accept a `locale` and `timeZone` for deterministic output on a server. They also accept `onUnbound`, which decides what a piece whose bound data wasn't resolved reads as.

**`@intentface/chat/genui-render`** draws a spec or view with your components (`GenUi.Root`, `GenUi.Spec`, `GenUi.View`):

- The component map is typed against the catalog.
- Last-parsed props are held while the input streams.
- Each piece has its own error boundary.
- `Placeholder`, `Pending`, `Unbound` and `Arrive` slots.
- `useGenUiElement` and `useGenUiLive`.

It reads no thread or message context.

`zod` (`^4.3.0`) is a new optional peer dependency, needed only by these two entries.
