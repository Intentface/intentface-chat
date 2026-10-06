---
"@intentface/chat": minor
---

Four additions to `Nav` and `Tabs`, found by building a real app's file tree and page tabs on them. All are additive; nothing changes unless you opt in, apart from the new `aria-current` attribute and a disabled-trigger fix.

**`Nav`: a branch that is also a destination.** `Nav.Trigger` gains `toggleOnClick` (default `true`). Turned off, pressing the row — click, Enter, Space — activates it like `Nav.Item`, so its `onClick` can route, and the new `Nav.Toggle` part carries the disclosure: a caret inside the row. The toggle is pointer-only and `aria-hidden`, because the row keeps `aria-expanded` and ArrowRight/ArrowLeft open and close the group exactly as before. It stops click, `dblclick` and pointerdown, so none of them reach the row.

A disabled `Nav.Trigger` now also prevents the click's default action, as a disabled `Nav.Item` always has — so one rendered as a link no longer navigates while disabled.

**`Nav`: `aria-current="page"` on active rows.** `active` on `Nav.Item` and `Nav.Trigger` previously produced only `data-active`, which assistive tech cannot see. Your own `aria-current` still wins.

**`Tabs`: `openOnHover`.** `Tabs.Trigger` gains `openOnHover`, `openDelay` (50ms) and `closeDelay` (50ms). Resting the mouse on a tab opens it, and leaving closes it again unless the mouse heads into the popup, which a prediction cone tracks. A press on the tab, or a press or focus inside the popup, keeps it open. Hover never takes over a tab someone opened with a press, and only a mouse hovers.

**`Tabs`: change event details.** `onValueChange` and `onItemsChange` receive a second argument, `eventDetails`, with `reason`, `event`, `trigger`, `cancel()` and `isCanceled`. Cancelling stops the change landing, so an editor can cancel a close in `onItemsChange` and ask about unsaved work first. The selection that follows a close is reported but cannot be cancelled, since its tab is already gone. The reasons are `"trigger-press"`, `"trigger-hover"`, `"list-navigation"`, `"close-press"`, `"keyboard"`, `"escape-key"` and `"imperative-action"`. Callbacks that take one argument keep working.
