# Intentface CLI

Install Intentface UI and AI primitives into a Next.js + TypeScript + Tailwind v4 project. Works like `shadcn/ui`: source files are copied into your repo, internal imports are rewritten to match your aliases, missing npm dependencies are installed, and a managed CSS block is upserted into your global stylesheet.

## Requirements

- Node.js 20 or later
- A project with `next`, `react`, `tailwindcss@^4`, and a `tsconfig.json`

The CLI fails fast with a friendly error if any of these are missing.

## Quick Start

```sh
# 1. Initialize: writes intentface.json, drops in lib/utils.ts, adds the theme block to globals.css
npx intentface@latest init

# 2. Add primitives by name (transitive deps are resolved automatically)
npx intentface@latest add button message

# 3. Install a bundle and its example wiring
npx intentface@latest add chat-primitives --example
```

After that, import from the aliases declared in your `intentface.json`:

```tsx
import { Composer } from "@/components/ai/composer";
import { Message } from "@/components/ai/message";
import { cn } from "@/lib/utils";
```

## Commands

### `intentface init`

- Detects your project layout (path aliases from `tsconfig.json`, plus any existing `components.json` from shadcn) and infers an `intentface.json` config.
- Locates your global CSS file (defaults to `app/globals.css`, falls back through common variants).
- Writes `intentface.json` so subsequent `add` calls reuse the same paths.
- Installs `lib/utils.ts` (with `clsx` and `tailwind-merge`).
- Inserts the Intentface theme tokens between `/* intentface:start */` and `/* intentface:end */` markers in your global CSS.

Run `init` once per project. Re-running it is safe — the CSS block is idempotent and existing files are left alone unless you pass `--overwrite` or `--yes`.

### `intentface add <items...>`

Copies the requested registry items (and their transitive dependencies) into your project.

- Public items — full list in [Registry items](#registry-items). Common ones:
  - `button`, `icon-button`, `input`, `textarea`, `checkbox`, `radio-group`, `select`, `slider`, `kbd`, `dropdown-menu`, `collapsible`, `dialog`, `drawer`, `tooltip`, `hover-card`, `separator`, `skeleton`, `sidebar`, `markdown`, `diffusion-markdown`, `progressive-blur`, `text-shimmer`, `text-loop`, `input-group`, `button-group`, `commands`, `attachments`
  - `composer`, `message`, `thread`, `steps`, `reasoning`, `step-queue`, `artifact-card`, `artifacts-panel`
  - Bundles: `ui-primitives`, `chat-primitives`, `chat-demo`
- With `--example`, optional example/demo files are also pulled in (e.g. a wired chat page).
- Files written through `add` go to the locations defined in `intentface.json` (typically `components/ui/*`, `components/ai/*`, `hooks/*`, `lib/*`).
- Internal imports inside the copied files are rewritten to use your aliases. If an alias isn't configured for a particular tree, a relative import is emitted instead.
- Missing npm packages from each item's `dependencies` and `devDependencies` are installed using whichever package manager your repo uses (detected via lockfile: `bun.lock`, `pnpm-lock.yaml`, `yarn.lock`, otherwise `npm`).

### `intentface list`

Prints all registry items that are user-addressable, with their titles or descriptions.

### `intentface help` (or `--help`, `-h`)

Prints the same usage summary as below.

## Options

All options work with both `init` and `add` unless noted.

| Flag                  | Behavior                                                                                          |
| --------------------- | ------------------------------------------------------------------------------------------------- |
| `-c, --cwd <path>`    | Run as if invoked from `<path>` instead of the current directory                                  |
| `-y, --yes`           | Assume "yes" to every prompt — overwrite existing files and install dependencies without asking  |
| `--overwrite`         | Overwrite existing files (no effect on dependency prompt)                                          |
| `--skip-existing`     | Keep existing files untouched, even if `--yes` is set                                              |
| `--dry-run`           | Print the plan (files that would be written, deps that would be installed) without changing disk |
| `--example`           | Include optional example/demo files (only meaningful for `add`)                                    |
| `-h, --help`          | Show usage and exit                                                                                |

### Conflict resolution order

When a target file already exists, the CLI decides what to do in this order:

1. `--overwrite` or `--yes` → write
2. `--skip-existing` → skip
3. Non-interactive shell (e.g. CI) → skip
4. Interactive shell → prompt `[y/N]` per file

Use `--dry-run` first if you're unsure what an `add` will touch.

## `intentface.json`

`init` writes this file to the project root. `add` reads it on every run. Defaults:

```jsonc
{
  "$schema": "https://intentface.dev/schema.json",
  "tsx": true,
  "tailwind": {
    "css": "app/globals.css"
  },
  "sourceRoot": "",
  "aliases": {
    "components": "@/components",
    "ui":         "@/components/ui",
    "ai":         "@/components/ai",
    "hooks":      "@/hooks",
    "lib":        "@/lib",
    "utils":      "@/lib/utils"
  }
}
```

- **`tailwind.css`** — path to your global stylesheet (the file that contains `@import "tailwindcss";`). The Intentface theme block is upserted here.
- **`sourceRoot`** — set to `"src"` if your code lives under `src/`. The CLI auto-detects this from `tsconfig.json` paths (e.g. `"@/*": ["src/*"]`) and rewrites target paths accordingly.
- **`aliases`** — TypeScript import aliases per tree. The CLI prefers the most specific match: a file under `components/ui/` will be imported via `aliases.ui`, not `aliases.components`. If an alias is empty/missing, the CLI emits a relative path instead.

If a `components.json` from shadcn is present, its aliases and `tailwind.css` are picked up automatically during `init`.

## CSS block

The theme tokens are written between markers in your global CSS:

```css
/* intentface:start */
@source "../node_modules/streamdown/dist/*.js";
@custom-variant dark (&:is(.dark *));

:root {
  --bg: #ffffff;
  --fg: #1a1a1a;
  /* ... */
}
/* intentface:end */
```

`@source` paths inside the block are rewritten relative to your global CSS file (so a `src/app/globals.css` setup gets `../../node_modules/...` automatically). Anything outside the markers is left untouched, so it's safe to keep your own CSS in the same file.

## Installed manifest

Each successful run records what was installed in `.intentface/installed.json`:

```json
{
  "registryVersion": "0.1.0",
  "updatedAt": "2026-04-30T12:34:56.000Z",
  "items": { "button": { "name": "button", "version": "0.1.0", "type": "registry:ui" } },
  "files": {
    "components/ui/button.tsx": { "path": "components/ui/button.tsx", "hash": "sha256-..." }
  }
}
```

Use this file to track what's been pulled in and to detect drift if you've edited the copied source.

## Examples

```sh
# Add the full UI bundle (every primitive in components/ui)
npx intentface@latest add ui-primitives

# Add the chat primitives plus the demo page that wires them up
npx intentface@latest add chat-primitives --example

# Update an item — this will prompt before overwriting
npx intentface@latest add composer

# Force overwrite without prompting (e.g. when re-syncing after upstream changes)
npx intentface@latest add composer --yes

# See what would change without writing anything
npx intentface@latest add chat-primitives --dry-run

# Run from a different working directory (e.g. inside a monorepo)
npx intentface@latest add button --cwd packages/app
```

## How it works

1. **Resolve.** The CLI loads `registry/registry.json` (a pre-built bundle of every item's source contents and metadata), then walks the dependency graph for the items you asked for.
2. **Plan.** It produces an install plan: a list of files (with rewritten target paths under `sourceRoot`), CSS blocks to upsert, and npm `dependencies` / `devDependencies` to install.
3. **Rewrite imports.** Each file's `@/...` and relative imports are re-resolved against the plan and rewritten to use your aliases (or to relative paths when no alias matches).
4. **Apply.** Files are written (with conflict prompts), the CSS block is upserted, dependencies are installed in two passes (regular and dev), and `.intentface/installed.json` is updated.

The whole pipeline is exposed from `intentface` as well, so if you need to embed it into your own tooling: `import { addItems, initProject, loadRegistry } from "intentface"`.

## Registry items

Run `npx intentface@latest list` to see every public item with its title. The current bundles are:

- **`ui-primitives`** — every component in `components/ui/`.
- **`chat-primitives`** — every component in `components/ai/` (Composer, Message, Thread, Steps, Reasoning, …) plus the AI types and message-utils helpers.
- **`chat-demo`** — `chat-primitives` plus the example wiring (`--example` is implied).

## Troubleshooting

- **"Missing: tailwindcss"** — install Tailwind CSS v4 (`npm i -D tailwindcss@^4`). v3 isn't supported because the theme uses `@theme inline` and `@custom-variant`.
- **"Missing value for --cwd"** — you wrote `--cwd` without a path. Either drop the flag or pass a directory.
- **Files weren't overwritten** — by default the CLI is conservative. Pass `--yes` (or `--overwrite`) to replace existing files.
- **Dependencies weren't installed** — re-run with `--yes` to skip the install confirmation, or run the printed `npm/pnpm/yarn/bun add ...` command manually.
