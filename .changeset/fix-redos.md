---
"@intentface/chat": patch
---

Fix two quadratic-backtracking regexes that could hang the browser.

`parseChipSegments` is the serious one, because message text is untrusted — it
arrives from the model. The chip token pattern's label group was `[^\]]+`, so
text containing a long run of `[` with no closing bracket made the engine consume
to the end, fail, backtrack over every position, advance one character and repeat.
Measured on an unclosed run: 355ms at 32k characters, growing quadratically — a
200k-character message would have hung a tab for roughly fourteen seconds.
Excluding `[` from the label class makes it linear. Labels containing brackets
never round-tripped through this pattern anyway, so nothing that previously
parsed stops parsing.

`detectActivePrefix` had the same shape via `/\S*$/`, which retries from every
position when the text ends in whitespace. It runs on every keystroke, so pasting
a large single-token blob froze the editor — 16 seconds for a 200k-character run.
Replaced with a backwards index scan, which is linear, allocation-free, and
returns identical results.

Both are covered by regression tests asserting a time budget that the previous
implementations exceeded by two orders of magnitude.
