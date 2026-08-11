---
"@intentface/chat": patch
---

Fix `Composer.Textarea` accumulating phantom newlines during rapid editing. The editor's padding `<br>` is now marked with `data-padding-break` and recognized structurally instead of being inferred from position, so a native edit that strands it mid-document no longer reads it back as real content. The padding also stops consuming a caret position, keeping the DOM's position space aligned with the model's length.
