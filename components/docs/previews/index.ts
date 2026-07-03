import type { ComponentType } from "react";
import { ComposerBasic } from "./composer-basic";
import { ComposerCommands } from "./composer-commands";

// Explicit registry of live docs demos. Each entry pairs the rendered component
// with its own source path so ComponentPreview can show the exact file that
// runs (read from disk at build time). A generator would be overkill at this
// scale — add an entry per demo.
export type PreviewEntry = {
  Component: ComponentType;
  file: string;
};

export const previews: Record<string, PreviewEntry> = {
  "composer-basic": {
    Component: ComposerBasic,
    file: "components/docs/previews/composer-basic.tsx",
  },
  "composer-commands": {
    Component: ComposerCommands,
    file: "components/docs/previews/composer-commands.tsx",
  },
};
