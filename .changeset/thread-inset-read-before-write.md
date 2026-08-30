---
"@intentface/chat": patch
---

`Thread` no longer loses a few pixels of scroll position when the composer changes height. Adding or discarding an attachment — anything that grows or shrinks the dock while you are pinned to the bottom — nudged the transcript down by a handful of pixels and never gave them back. Repeated often enough, the thread drifted away from the live edge.

`useThreadInsets` derives two custom properties from one dock measurement, and they are designed to cancel: the content wrapper pads by `--thread-overlay-bottom-height`, and the same inset is subtracted from `--thread-turn-area`, which the last turn reserves. Their sum is constant, so the scrollable height should never move when the dock resizes.

It moved anyway, because the write order broke the cancellation. The padding was written first, then `measureTopInset` and `root.clientHeight` were read — both force a synchronous layout. That layout ran with the *new* padding against the *old* reserve, so `scrollHeight` dipped for exactly one frame. The browser clamps `scrollTop` to fit shorter content, and clamping is not reversed when the content grows back a frame later, so each dock resize cost a few pixels permanently.

Every measurement is now read before either property is written, so both land in the same recalculation and no intermediate layout exists to clamp against. Measured across an attachment discard: `--thread-turn-area` climbs 504px → 566px over 23 frames while `scrollTop`, the scroll maximum, and the last turn's on-screen position all hold still. Previously `scrollTop` dropped 5351 → 5345 on the third frame and stayed there.
