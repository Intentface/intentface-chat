---
"@intentface/chat": minor
---

- [GenUi] New `@intentface/chat/genui` entry, experimental: the headless core of generative UI. A catalog of elements and views with zod schemas, `canonicalSpec` and `canonicalView` to accept model input, `readStoredSpec` for stored specs, streaming reads, `$data` bindings and an escaped Markdown export. Imports no React.
- [GenUi] New `@intentface/chat/genui-render` entry, experimental: `GenUi.Root`, `GenUi.Spec` and `GenUi.View` draw a spec or a view with your components, steady while it streams.
- Add `zod` 4 as an optional peer dependency, needed only by the genui entries.
