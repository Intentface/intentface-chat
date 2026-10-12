---
"@intentface/chat": minor
---

`Thread` scroll timing is now set from CSS.

**Timed smooth scrolls.** Set `--thread-scroll: <duration> <easing>` on the thread root (or the `--thread-scroll-duration` / `--thread-scroll-easing` longhands) and every smooth scroll — the landing, the follow, `scrollToBottom`, `scrollToTop`, `scrollToMessage` — is animated by the thread with that timing. Any CSS easing works, `linear()` included, so a Motion `spring()` string drops in as-is. `--thread-scroll-speed` paces the duration by distance instead, capped by the duration when both are set.

**`data-scrolling` on the root.** While a timed scroll runs, the root carries `data-scrolling="land" | "follow" | "bottom" | "top" | "message"`. It is set before the timing is read, so selectors can give each kind its own timing.

**Streaming mid-flight.** The destination is re-read every frame, so a reply that starts streaming during a long landing is carried along instead of restarting the scroll. In `"jump"` the landing's destination is fixed when it starts. Any wheel, touch, scroll key or scrollbar press stops the animation where it is; under `prefers-reduced-motion` every scroll is instant.

**Opting out.** `--thread-scroll: none` keeps the native smooth scroll over any longhand, so a thread can opt back out of a timing set further up.

Nothing changes without the variables: smooth scrolls stay native.

**Fixes along the way.**
- `isAtBottom` / `data-at-bottom` no longer stay stuck after `scrollToTop` or `scrollToMessage` moves away from the bottom: the bottom edge leaving view is no longer swallowed as a scroll of the thread's own.
- Under `prefers-reduced-motion`, scrolls are instant even when the scroller's CSS sets `scroll-behavior: smooth` (they resolved to `auto`, which defers to it).
