---
"@intentface/chat": minor
---

- [GenUi] New `@intentface/chat/genui` entry, experimental: the headless core of generative UI. A catalog of elements and views with zod schemas, `canonicalSpec` and `canonicalView` to accept model input, render props, UI state, the `genUiTool` helper, streaming reads, `$data` bindings and an escaped Markdown export. Imports no React.
- [GenUi] New `@intentface/chat/genui-render` entry, experimental: `GenUi.Root`, `GenUi.Spec`, `GenUi.View` and `GenUi.Part` draw a spec or a view with your components from render props, steady while it streams.
- [GenUi] New `@intentface/chat/genui-testing` entry, experimental: `checkComponents` checks a component map against every fixture of a catalog.
- Add `zod` 4 and `@testing-library/dom` 10 as optional peer dependencies, needed only by the genui entries.
