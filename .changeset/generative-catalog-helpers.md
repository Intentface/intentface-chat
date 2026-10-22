---
"@intentface/chat": minor
---

- New `@intentface/chat/generative` entry: typed helpers that check a model's UI tool call against a catalog (`defineCatalog`, `toJSONSchema`, `validateTree`), read it while it streams (`useTree`, `readTree`), resolve its data bindings (`resolveBindings`) and write it as Markdown (`toMarkdown`).
