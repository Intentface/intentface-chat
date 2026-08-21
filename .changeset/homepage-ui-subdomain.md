---
"@intentface/chat": patch
---

Point `homepage` and the README at `https://ui.intentface.com`. The previous address, `intentface.dev`, does not resolve — so the link on the npm page and the two documentation links inside the shipped README were dead. The documentation now also lives at the root of that host rather than under `/docs`, so the paths lose that prefix.

No code change; published metadata only.
