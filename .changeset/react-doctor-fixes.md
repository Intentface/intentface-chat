---
"@intentface/chat": patch
---

- [AskUser] Fix `AskUser.Options` and `AskUser.Option` writing to refs during render.
- [Composer] Fix `Composer.Command` writing to a ref during render.
- [AskUser] Improve re-renders: `AskUser.Root`, `AskUser.Options` and `AskUser.Option` memoize their context values.
- [Reasoning] [Steps] Improve re-renders: their collapsible context is memoized.
- [Tabs] Improve re-renders: the anchored surface memoizes its context value.
