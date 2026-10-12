---
"@intentface/chat": patch
---

A composer embedded in a scrolling page no longer scrolls that page.

**Programmatic text changes.** `clear()`, `setText()` and the ask-user step changes used to nudge the page by a few pixels each time. Keeping the caret in view after a write now scrolls only the composer's own scroll areas, never past `Composer.Root`. A caret on an empty line, including an empty editor's, is measured by that line's break: on its own it has no box, and its all-zero rect read as "above the view". A trailing empty line in an overflowing composer now scrolls into view too.

**Ask-user focus moves.** Moving into the options, arrowing between them, and typing to answer move focus without the browser's focus-scroll. An option outside its own list's view is still brought into view within the question.

**`focus(options)`.** The composer controller's `focus` now takes `HTMLElement.focus()`'s options, so a consumer can focus an on-screen composer with `{ preventScroll: true }`. Called with no arguments, it behaves as before.
