---
"@intentface/chat": patch
---

Fix the published registry metadata advertising `./src/*.ts` exports. The tarball was always correct, so installs and resolution were unaffected, but `npm view @intentface/chat exports` showed the dev paths — enough to look like a broken publish. The exports swap is now restored in `postpublish` rather than `postpack`, so it survives until npm has built the packument.
