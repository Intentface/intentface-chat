import type { ComponentType } from "react";
import { AttachmentsBasic } from "./attachments-basic";
import { ChipBasic } from "./chip-basic";
import { ComposerAskUser } from "./composer-ask-user";
import { ComposerAskUserFlow } from "./composer-ask-user-flow";
import { ComposerAttachments } from "./composer-attachments";
import { ComposerBasic } from "./composer-basic";
import { ComposerCommands } from "./composer-commands";
import { ComposerControlled } from "./composer-controlled";
import { ComposerPopover } from "./composer-popover";
import { ComposerStoreDemo } from "./composer-store";
import { MessageBasic } from "./message-basic";
import { ReasoningBasic } from "./reasoning-basic";
import { StepsBasic } from "./steps-basic";
import { ThreadBasic } from "./thread-basic";

// Explicit registry of live docs demos. Each entry pairs the rendered component
// with its own source path so ComponentPreview can show the exact file that
// runs (read from disk at build time). A generator would be overkill at this
// scale — add an entry per demo.
export type PreviewEntry = {
  Component: ComponentType;
  file: string;
};

const dir = "components/docs/previews";

export const previews: Record<string, PreviewEntry> = {
  "composer-basic": { Component: ComposerBasic, file: `${dir}/composer-basic.tsx` },
  "composer-commands": { Component: ComposerCommands, file: `${dir}/composer-commands.tsx` },
  "composer-ask-user": { Component: ComposerAskUser, file: `${dir}/composer-ask-user.tsx` },
  "composer-ask-user-flow": {
    Component: ComposerAskUserFlow,
    file: `${dir}/composer-ask-user-flow.tsx`,
  },
  "composer-attachments": {
    Component: ComposerAttachments,
    file: `${dir}/composer-attachments.tsx`,
  },
  "composer-controlled": { Component: ComposerControlled, file: `${dir}/composer-controlled.tsx` },
  "composer-popover": { Component: ComposerPopover, file: `${dir}/composer-popover.tsx` },
  "composer-store": { Component: ComposerStoreDemo, file: `${dir}/composer-store.tsx` },
  "thread-basic": { Component: ThreadBasic, file: `${dir}/thread-basic.tsx` },
  "message-basic": { Component: MessageBasic, file: `${dir}/message-basic.tsx` },
  "chip-basic": { Component: ChipBasic, file: `${dir}/chip-basic.tsx` },
  "reasoning-basic": { Component: ReasoningBasic, file: `${dir}/reasoning-basic.tsx` },
  "steps-basic": { Component: StepsBasic, file: `${dir}/steps-basic.tsx` },
  "attachments-basic": { Component: AttachmentsBasic, file: `${dir}/attachments-basic.tsx` },
};
