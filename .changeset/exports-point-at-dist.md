---
"@intentface/chat": patch
---

`exports` now points at `./dist` permanently, so the registry metadata matches the tarball. Previously `exports` pointed at `./src/*.ts` in the repo — so the docs app could consume package source with no build step — and a `prepack`/`postpack` pair swapped it to `./dist` for packing. npm builds the packument from `package.json` as it stands *after* `postpack`, which restored the source paths, so every published version advertised `./src/*.ts` for all 11 subpaths: files the tarball does not ship.

Consumers were never affected, because Node resolves against the `package.json` inside the tarball, which always carried the correct `./dist` paths. But `npm view @intentface/chat exports` reported paths that do not exist, which reads exactly like a broken publish — and npm was warning that `publishConfig.exports` "will stop working in the next major version of npm", so the mechanism had an expiry date regardless.

The swap is gone: `scripts/swap-exports.mjs`, the `postpack` hook, and `publishConfig.exports` are all deleted, and `prepack` now just runs the build. The app gets source resolution from the repo instead of from the published exports map — a `paths` entry in `tsconfig.json` and a matching Turbopack `resolveAlias` in `next.config.ts`, both mapping the 11 subpaths to `packages/chat/src`. Verified by building the docs app with `packages/chat/dist` deleted entirely.

No API change; nothing to migrate.
