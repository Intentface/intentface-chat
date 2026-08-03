import { defineConfig } from "bunup";

// One self-contained output file per public entry point (subpath exports),
// ESM only, with declaration files. Splitting is OFF: it hoists a re-export-only
// entry's body into a shared chunk, which strips the entry's own "use client"
// directive and moves the RSC boundary off the module the consumer imports. The
// cost is duplicating the small internal/ helpers across entries — cheap next to
// a correct client boundary. Dependencies and peers are externalized from
// package.json automatically.
//
// dts.inferTypes is REQUIRED, not an optimization. bunup's default declaration
// emit uses TypeScript's isolated-declarations mode, which cannot infer the type
// of an `Object.assign(Root, {...})` compound — it warns TS9010 and emits
// `declare const Thread: unknown`. That erased every compound component in the
// public API while still producing .d.ts files that publint happily accepted.
// inferTypes routes emit through tsc so the compound types are inferred.
//
// The build script pins NODE_ENV=production, and that is load-bearing: with it
// unset the transpiler emits jsxDEV from react/jsx-dev-runtime, which throws
// "jsxDEV is not a function" in any consumer's production build. The `jsx:
// { development: false }` option looks like the declarative fix but bunup
// 0.16.32 ignores it — verified — so the env var is the only lever.
export default defineConfig({
  entry: [
    "src/types.ts",
    "src/composer/index.tsx",
    "src/chip.tsx",
    "src/thread/index.tsx",
    "src/reasoning.tsx",
    "src/steps.tsx",
    "src/attachments.tsx",
    "src/ask-user.tsx",
    "src/message.tsx",
    "src/message-utils.ts",
    "src/chip-markdown.ts",
  ],
  format: ["esm"],
  dts: { inferTypes: true },
  splitting: false,
  clean: true,
});
