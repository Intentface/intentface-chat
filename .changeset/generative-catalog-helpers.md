---
"@intentface/chat": minor
---

- New `@intentface/chat/generative` entry, experimental: typed helpers that check a model's UI tool call against a catalog (`defineCatalog`, `tree.schema`, `tree.validate`), read it while it streams (`useTree`, `tree.read`), resolve its data bindings (`bindings.resolve`) and write it as Markdown (`markdown.tree`).
