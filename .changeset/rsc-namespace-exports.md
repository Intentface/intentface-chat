---
"@intentface/chat": minor
---

**Breaking:** primitives are now namespace exports, and the root part is explicit. `<Composer>` becomes `<Composer.Root>`, `<Message>` becomes `<Message.Root>`, and likewise for `Thread`, `Steps`, `Reasoning`, `Chip`, `Attachments` and `AskUser`. Sub-component names (`Composer.Container`, `Message.Text`, …), hooks, and type names are unchanged, so the migration is mechanical:

```diff
-<Message role="assistant">
+<Message.Root role="assistant">
   <Message.Text>{text}</Message.Text>
-</Message>
+</Message.Root>
```

This makes the primitives usable from React Server Components. Previously every sub-component resolved to `undefined` in a server component, failing the render with `Element type is invalid… but got: undefined` — a server component importing a `"use client"` module receives a proxy of its *named exports* and cannot read properties off an exported value, which is where `Object.assign` put them. Rendering a static transcript from a server component now works; the parts remain client components, so interactive props and hooks behave exactly as before.

The package also now ships unbundled, one module per source file, because a bundle can carry only one top-level `"use client"` directive and that collapses the per-part boundaries the above depends on. Two incidental wins from building with tsc: declarations are inferred properly (the previous isolated-declarations emit erased every compound component to `unknown`) and the production `react/jsx-runtime` is always used (the previous build emitted the development runtime, which throws `jsxDEV is not a function` in a consumer's production build).
