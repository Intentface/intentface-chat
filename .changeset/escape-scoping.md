---
"@intentface/chat": minor
---

Escape now reaches only the thing it was meant for, found by putting a `Composer` inside a floating `Tabs.Popup`.

**`Tabs`: an Escape something else handled no longer closes the panel.** `Tabs.Root`'s `dismissOnEscape` closed the open panel on every Escape, even one another handler had already used and marked with `preventDefault()`. A composer inside the popup stopping a reply, or closing its command list, closed the popup with the same press. Now each press peels one layer.

**`Composer`: Escape stops only the composer it was pressed in.** While `isGenerating`, `Composer.Submit` (and `useComposerSubmit`) stopped on an Escape anywhere on the page. With two composers on a page, an Escape typed into one stopped the other, and an Escape in an unrelated text field stopped it too. The stop now runs from `Composer.Root`'s `onKeyDown`, so it hears only Escapes from inside that composer, including parts a positioned `Composer.Panel` renders elsewhere on the page. A consumer's `onKeyDown` can skip it with `event.preventPrimitiveHandler()`.

**Breaking:** an Escape pressed after focus has left the composer (the page body, a button, the transcript) no longer stops generation. An app that wants that handles Escape on its chat's container, such as `Thread.Root`, and calls its own stop.
