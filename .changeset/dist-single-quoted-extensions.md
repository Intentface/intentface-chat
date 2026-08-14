---
"@intentface/chat": patch
---

Add the missing `.js` extensions to single-quoted specifiers in `dist`, which
made the package unloadable under SSR.

`add-dist-extensions` matched only double-quoted specifiers. The vendored files
under `src/internal/render` came from Base UI's source and use single quotes, so
21 of their relative specifiers (13 in `.js`, 8 in `.d.ts`) shipped
extensionless. Bundlers resolve those, which is why the browser was fine; Node's
ESM resolver requires fully-specified paths and threw
`Cannot find module .../internal/render/useMergedRefs` on the first import. Every
part goes through `useRenderElement`, so importing *any* entry point on a server
failed — a Next or TanStack Start app rendered nothing server-side and silently
fell back to client rendering.

The pattern now captures the quote character and backreferences it, so both
styles are rewritten and the quote is preserved.

The build now ends with a smoke test that imports every subpath in
`publishConfig.exports` under Node — the entire consumer-reachable surface. The
failure was a resolution error the rewrite script could not see (its own pattern
was the blind spot) and publint does not resolve the internal graph, so the guard
tests resolution itself: against the previous rewrite, 8 of the 11 entries fail
to load; the next regression breaks the build instead of a consumer's server.
