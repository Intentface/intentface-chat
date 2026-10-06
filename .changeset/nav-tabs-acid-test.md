---
"@intentface/chat": minor
---

Four additions to `Nav` and `Tabs`, found by building a real app's file tree and page tabs on them. All are additive; nothing changes unless you opt in, apart from the new `aria-current` attribute and a disabled-trigger fix.

**`Nav`: a branch that is also a destination.** `Nav.Trigger` gains `toggleOnClick` (default `true`). Turned off, pressing the row — click, Enter, Space — activates it like `Nav.Item`, so its `onClick` can route, and the new `Nav.Toggle` part carries the disclosure: a caret inside the row. The toggle is pointer-only and `aria-hidden`, because the row keeps `aria-expanded` and ArrowRight/ArrowLeft open and close the group exactly as before. It stops click, `dblclick` and pointerdown, so none of them reach the row.

A disabled `Nav.Trigger` now also prevents the click's default action, as a disabled `Nav.Item` always has — so one rendered as a link no longer navigates while disabled.

**`Nav`: `aria-current="page"` on active rows.** `active` on `Nav.Item` and `Nav.Trigger` previously produced only `data-active`, which assistive tech cannot see. Your own `aria-current` still wins.

**`Tabs`: peek.** A tab can now float over the page without being selected. `peek` / `defaultPeek` / `onPeekChange` on `Tabs.Root` and `peek` / `setPeek` on the store form a second channel beside the selection, and `<Tabs.Portal peek>` points its Positioner, Popup and Viewport at it. `peekOnHover` on a trigger opts it into Shell-style hover intent:

- `peekDelay` (300ms) before it opens, and `peekCloseDelay` (250ms) after the pointer leaves, so the pointer can cross into the surface.
- Hovering another tab switches the peek straight away.
- A press or focus inside holds the peek open until Escape, an outside press, or selecting the tab.
- Only a mouse hovers.

The selected tab never peeks, and selecting the peeked tab ends the peek. Escape now ends a peek before it would touch the selection, whatever `dismissOnEscape` says. A Portal without `peek` behaves exactly as before.

**`Tabs`: `onCloseRequest`.** It runs before `Tabs.Close` or Delete/Backspace closes a tab, and before anything changes. `details.cancel()` keeps the tab, and `details.reason` is `"close-button"` or `"delete-key"`. `close()` called in code never asks. It exists for editors with unsaved work, which previously had no way to veto a close: controlled `items`/`value` see it as two unrelated writes, and Delete bypassed a custom ×.
