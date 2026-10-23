# Changesets

This folder is managed by [changesets](https://github.com/changesets/changesets). Each
pull request that changes a published package (`@intentface/ui`) should add a changeset:

```bash
bunx changeset
```

Pick the bump (major / minor / patch) and write a summary — it becomes the changelog
entry. On merge to `main`, the release workflow opens (or updates) a "Version Packages" PR;
merging that PR publishes to npm.

## Writing the summary

`changelog.cjs` prints the summary as-is, so write only what a user of the package needs:

- One line per change: what changed, not how or why. The reasoning goes in the PR body.
- Lead with the primitive in brackets (`[Thread]`), shown as a badge in the docs. Leave it off
  a line that isn't about one primitive.
- Then a verb (Add, Fix, Improve, Remove) or "New", with API names in code spans.
- A breaking change adds a `[Breaking]` tag and the migration in one sentence. Before 1.0 it
  ships as a minor bump, so the tag is what marks it.

```md
---
"@intentface/ui": minor
---

- [Composer] Fix an Escape in one composer stopping generation in another.
- [Composer] [Breaking] Escape stops generation only from inside `Composer.Root`. To stop on any Escape, handle it on your chat container, such as `Thread.Root`.
```

If a package change intentionally needs no release, add an empty changeset instead:

```bash
bunx changeset --empty
```

The app (`intentface-ui`) is private, so changesets skips it — `@intentface/ui` is the
only published package.
