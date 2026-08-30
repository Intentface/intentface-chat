---
"@intentface/chat": patch
---

`Thread` no longer chases the live edge with a smooth scroll while the container around it is being resized. A consumer that animates the thread open — a collapsed pill springing to a panel, a drawer sliding in — saw the transcript land mid-viewport and then visibly scroll to the bottom over the length of the animation. It now lands at the bottom and stays there.

The follow is driven by a `ResizeObserver` on the content column, which fires for two different things it could not tell apart: a token streaming in, and the viewport itself changing size. The second is not hypothetical for auto-scrolling threads — in every mode that lands at the top (`follow`, `jump`), the last turn reserves a viewport via `--thread-turn-min-height: var(--thread-turn-area)`, and `--thread-turn-area` is derived from the thread root's `clientHeight`. So a container animating its height rewrites that variable each frame, resizing the content column each frame, and each resize was answered with a fresh smooth scroll to a target that had already moved.

`follow` now compares the scroll viewport's own box against the previous callback's. Streamed content never changes it; a container animating open, a window resize, or a growing composer dock always does. A changed box still pins to the live end — it just does so instantly, which is the whole difference between landing at the bottom and animating toward it. Width is compared alongside height, so a container that expands horizontally and reflows the transcript is covered too.

The intent-only gating is unchanged: the resize branch is a synchronous `clientWidth` / `clientHeight` read inside the observer callback, not the one-frame-stale at-bottom snapshot that `follow` deliberately avoids consulting. Threads in a static container are unaffected — the viewport box never changes, so every callback takes the existing smooth path.

`autoScroll="bottom"` never exhibited this, since it is the one mode that sets no reserve.
