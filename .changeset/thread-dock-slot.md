---
"@intentface/chat": minor
---

**Breaking:** `Thread.Root` no longer takes `dockSelector`. The thread now measures the `Thread.Composer` slot (`[data-thread-composer]`) it already renders, instead of querying the composer's internals for a set of dock parts. Dock your composer in the slot and the measurement is automatic:

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
