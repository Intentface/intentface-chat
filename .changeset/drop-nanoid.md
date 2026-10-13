---
"@intentface/chat": patch
---

Drop the `nanoid` dependency. The default attachment `convert` now uses the file's blob URL as its id, so `@floating-ui/dom` is the package's only runtime dependency. Ids are still unique per item, including the same file added twice; nothing in the package parses them, and a custom `convert` can still supply its own.
