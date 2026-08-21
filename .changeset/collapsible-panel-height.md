---
"@intentface/chat": minor
---

Disclosure panels (`Steps.Panel`, `Reasoning.Content`) no longer stay pinned to the height they had when they opened. The panel measures its natural height for the transition and then **releases** that measurement once the transition settles, so an open panel tracks content that appears underneath it — a nested disclosure expanding, rows streaming in. Previously the measurement was written on open and never cleared, so any consumer following the documented `height: var(…)` pattern had its content clipped at the open-time height.

**Breaking:** the measured height is published as `--panel-height` instead of `--collapsible-panel-height`. The old name leaked an internal: `Collapsible` is not a public part, cannot be imported, and appears nowhere in the docs, so a consumer styling `Steps.Panel` had to reach for a variable named after a component they could not see. The variable is now documented on both parts.

```diff
 [data-steps-panel] {
   overflow: hidden;
-  height: var(--collapsible-panel-height);
+  height: var(--panel-height);
   transition: height 150ms ease-out;
 }
```

Note the value is present only while the open or close transition runs, which is what makes the fallback to `auto` work while open. That is the intended contract, not a gap.

Two supporting changes, both internal:

- `useTransitionStatus` is now called with `enableIdleState` and `deferEndingState` enabled. `idle` is the settled-open status the release gates on, and deferring `ending` by a frame leaves one frame where a closing panel is still at its open size — which is where the close has to be measured. Previously the close was measured on the `ending` frame, with the closed styles already applied, so it measured the clamped box.
- The unmount is now gated on `transitionStatus === "ending"` rather than merely `!open`. With the ending state deferred, the earlier check could call `getAnimations()` before the closed styles landed, find nothing running, and cut the exit animation off. This also affects `Composer.Panel`, the other consumer of the shared transition hook.

Measurement also neutralizes inline alignment properties for the read and restores them immediately, matching Base UI — inline alignment can distort a scroll-based measurement.
