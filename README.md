# intentface-chat

Monorepo for **[@intentface/chat](https://www.npmjs.com/package/@intentface/chat)** — headless chat UI
primitives for React — and the documentation site and playground at
[intentface.dev](https://intentface.dev).

The package ships behavior, state, and wire formats with no styling of its own: a contenteditable
composer with commands and chips, a thread with scroll auto-follow, message part segmentation, tool-call
timelines. This is the Base UI model applied to chat — the package owns behavior, you own every class.

## Layout

| Path | What it is |
| --- | --- |
| `packages/chat` | The published package. Namespace exports per primitive, built per-module by `tsc`. |
| `content/docs` | Documentation pages (MDX, via fumadocs). |
| `components/docs` | Docs-site chrome: previews, code blocks, tables. |
| `components/ai`, `components/ui` | The playground's own styled layer. **App-private** — it uses design tokens, Motion, and local icons, and is not published or supported for copying. |
| `app/(chat)` | The playground chat. |
| `app/docs` | The documentation site. |

## Development

```bash
bun install          # also generates .source via fumadocs-mdx (postinstall)
bun dev              # http://localhost:3000
bun run lint         # biome check
bunx tsc --noEmit    # typecheck
bun run build        # production build
```

No environment variables are needed. The playground chat runs on your own OpenAI key, which you paste into the Key tab of the playground settings (top right of the chat) — it is held in an HttpOnly cookie and forwarded to OpenAI per request, never stored server-side.

Package tests and build:

```bash
cd packages/chat
bun test
bun run build
```

## Contributing

Conventions, architecture, and patterns live in [AGENTS.md](./AGENTS.md) — read it before opening a PR.
Changesets gate releases: run `bunx changeset` for any user-facing change to `packages/chat`.

## License

MIT
