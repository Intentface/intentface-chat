---
"@intentface/chat": patch
---

Fix two quadratic-backtracking regexes that could hang the browser.

`parseChipSegments` is the serious one, because message text is untrusted — it
arrives from the model. The chip token pattern had two independent blowups. A long
run of `[` with no closing bracket made the label group consume to end-of-string,
fail, backtrack over every position, advance one character and repeat: 355ms at
32k characters. Worse, `[a](chip:x:` repeated with no `)` anywhere did the same
through the value group from many start positions at once: 264ms at 88k
characters. Both grow quadratically, so a large message could hang a tab for
seconds.

Every character class now excludes `[`, so no group can consume past the next
one and the work per start position is bounded by the gap to it. Safe for
anything `encodeChipMarkdown` produces — values are `encodeURIComponent`-escaped,
queries come from `URLSearchParams`, prefixes are short identifiers — and labels
containing raw brackets never parsed under the previous pattern either.

`detectActivePrefix` had the same shape via `/\S*$/`, which retries from every
position when the text ends in whitespace. It runs on every keystroke, so pasting
a large single-token blob froze the editor — 16 seconds for a 200k-character run.
Replaced with a backwards index scan, which is linear, allocation-free, and
returns identical results.

Both are covered by regression tests asserting a time budget that the previous
implementations exceeded by two orders of magnitude.
