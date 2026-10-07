---
"@intentface/chat": patch
---

Escape now reaches only the thing it was meant for, found by putting a `Composer` inside a floating `Tabs.Popup`.

**`Tabs`: an Escape something else handled no longer closes the panel.** `Tabs.Root`'s `dismissOnEscape` closed the open panel on every Escape, even one another handler had already used and marked with `preventDefault()`. A composer inside the popup closing its command list, or stopping a reply, closed the popup with the same press, and so did a menu closing anywhere else on the page. The window listener now skips an event that is already `defaultPrevented`. It runs after every element and document listener, so anything that claims the key wins, and each press peels one layer.

**`Composer`: Escape stops only the composer it belongs to.** While `isGenerating`, `Composer.Submit` (and `useComposerSubmit`) stopped on any Escape anywhere in the document. With two composers on a page, an Escape typed into one stopped the other, and with both generating, whichever registered first stopped regardless of where you typed. An Escape in an unrelated text field stopped it too. It now stops on an Escape typed into its own composer (including its ask-user options, wherever a panel renders them), or into nothing in particular, such as the page body after focus left the editor, a button, or the transcript. An Escape typed into another composer, or into any other input, textarea or `contenteditable` editor, is left to that field.
