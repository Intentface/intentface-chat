---
"@intentface/chat": minor
---

Add three app-shell primitives alongside the chat ones: `Shell` (a collapsible,
resizable sidebar with hover-peek), `Nav` (a nav tree with roving focus,
typeahead and a guide ladder) and `Tabs` (an open-ended, closable collection
whose panel renders in the layout or anchored to its own tab). Each ships on the
usual three-module layout, so a server component reaches every part.

None of them persist anything or claim a global key: state goes out through
callbacks (`onOpenChange`, `onExpandedChange`, `onValueChange`, `onItemsChange`,
and the sidebar's `onResize`) and comes back in as `default*` props or, for the
sidebar's width, as the `--shell-sidebar-width` custom property. Where it is
kept, and which keystroke toggles what, stay the app's to decide.

Also fixes the shared transition internals: `useAnimationsFinished` now runs its
callback when there is no element rather than returning silently, which
previously left a closing `Composer.Panel` or popover mounted for good, and
gained a `subtree` option. `useAnchorPositioning` publishes
`--anchor-available-width` and no longer animates a surface in from its
pre-placement position.
