# Changesets

This folder is managed by [changesets](https://github.com/changesets/changesets). Each
pull request that changes a published package (`@intentface/chat`) should add a changeset:

```bash
bunx changeset
```

Pick the bump (major / minor / patch) and write a summary — it becomes the changelog
entry. On merge to `main`, the release workflow opens (or updates) a "Version Packages" PR;
merging that PR publishes to npm.

The app (`intentface-chat`) is private, so changesets skips it — `@intentface/chat` is the
only published package.
