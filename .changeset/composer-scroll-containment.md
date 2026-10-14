---
"@intentface/chat": patch
---

- [Composer] Fix an embedded composer scrolling the page around it on `clear()`, `setText()` and ask-user step changes.
- [Composer] Fix a trailing empty line in an overflowing composer not scrolling into view.
- [AskUser] Fix moving focus between options scrolling the page around an embedded question.
- [Composer] Add focus options to the controller's `focus()`, such as `{ preventScroll: true }`.
