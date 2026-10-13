---
"@intentface/chat": patch
---

`Composer.Popover` and an overlay `Composer.Panel` no longer break hydration when server-rendered. Both used to render nothing on the server but a portal on the first client render, which React reports as a mismatch. Every portaled part — Popover, Panel and `Tabs.Portal` — now goes through one shared portal that stays empty until hydration finishes, then mounts.
