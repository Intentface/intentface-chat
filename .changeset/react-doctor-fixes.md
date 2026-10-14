---
"@intentface/chat": patch
---

Render-safety and re-render fixes from a React Doctor review.

**No ref writes during render.** `AskUser.Options` and `AskUser.Option` mirror their latest values into refs in an insertion effect instead of during render, which React may discard. It runs before every layout effect, so options still seed the initial highlight from their own. `Composer.Command`'s "this prefix is the one closing" flag is now state that flips only at open and close.

**Stable context values.** `AskUser.Root`, `AskUser.Options`, `AskUser.Option`, the shared collapsible behind `Reasoning` and `Steps`, and the anchored `Tabs` surface memoize their context values, so memoized consumers no longer redraw on every parent render.
