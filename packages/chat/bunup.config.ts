import { defineConfig } from "bunup";

// One self-contained output file per public entry point (subpath exports),
// ESM only, with declaration files. Splitting is OFF: it hoists a re-export-only
// entry's body into a shared chunk, which strips the entry's own "use client"
// directive and moves the RSC boundary off the module the consumer imports. The
// cost is duplicating the small internal/ helpers across entries — cheap next to
// a correct client boundary. Dependencies and peers are externalized from
// package.json automatically.
export default defineConfig({
  entry: [
    "src/types.ts",
    "src/composer/index.tsx",
    "src/chip.tsx",
    "src/thread.tsx",
    "src/reasoning.tsx",
    "src/steps.tsx",
    "src/attachments.tsx",
    "src/ask-user.tsx",
    "src/message.tsx",
    "src/message-utils.ts",
    "src/chip-markdown.ts",
  ],
  format: ["esm"],
  dts: true,
  splitting: false,
  clean: true,
});
