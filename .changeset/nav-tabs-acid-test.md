---
"@intentface/chat": minor
---

Four additions to `Nav` and `Tabs`, found by building a real app's file tree and page tabs on them. All are additive; nothing changes unless you opt in, apart from the new `aria-current` attribute and a disabled-trigger fix.

**`Nav`: a branch that is also a page.** The new `Nav.Toggle` part is a caret for inside `Nav.Trigger`. Mounting it makes pressing the row (click, Enter or Space) activate it like `Nav.Item`, so its `onClick` or link routes, while the caret opens and closes the group. It is pointer-only and `aria-hidden`, because the row keeps `aria-expanded` and ArrowRight/ArrowLeft open and close the group as before. A press on the caret never follows a link row, and the caret respects a disabled trigger.

A disabled `Nav.Trigger` now also prevents the click's default action, as a disabled `Nav.Item` always has — so one rendered as a link no longer navigates while disabled.

**`Nav`: `aria-current="page"` on active rows.** `active` on `Nav.Item` and `Nav.Trigger` previously produced only `data-active`, which assistive tech cannot see. Your own `aria-current` still wins.

**`Tabs`: `openOnHover`.** `Tabs.Trigger` gains `openOnHover`, `openDelay` (50ms) and `closeDelay` (50ms). Resting the mouse on a tab opens it, and leaving closes it again unless the mouse heads into the popup, which a prediction cone tracks. A press on the tab, or a press or focus inside the popup, keeps it open. Hover never takes over a tab someone opened with a press, and only a mouse hovers.

**`Tabs`: change event details.** `onValueChange` and `onItemsChange` receive a second argument, `eventDetails`, with `reason`, `event`, `trigger`, `cancel()` and `isCanceled`. Cancelling stops the change landing, so an editor can cancel a close in `onItemsChange` and ask about unsaved work first. The selection that follows a close is reported but cannot be cancelled, since its tab is already gone. The reasons are `"trigger-press"`, `"trigger-hover"`, `"list-navigation"`, `"close-press"`, `"keyboard"`, `"escape-key"` and `"imperative-action"`. Callbacks that take one argument keep working.

Escape from inside a floating `Tabs.Popup` now hands focus back to its tab, instead of dropping it on the page as the popup closes.
