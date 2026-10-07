---
"@intentface/chat": patch
---

`Thread` keeps the bottom pinned while its container is resized.

**Resizing with a long last turn.** Dragging a chat window's height let the bottom drift out of view until the next content change re-pinned it, whenever the last turn was taller than its reserve: the content didn't change size, so nothing fired. The follow now observes the scroller as well as the content, so a resize re-pins in the same frame.

**No smooth scroll queued behind a resize.** One resize settles over several observer passes in a frame: the scroller's box changes first, then the content resizes to the new reserve a pass later. That later pass read as content growth and queued a smooth scroll behind the instant re-pin. Re-pins now stay instant for the rest of a frame in which the scroller resized.

New turns still land smoothly, streaming still follows smoothly, and scrolling up still releases the follow.
