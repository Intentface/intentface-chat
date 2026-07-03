import type { ComponentType } from "react";
import { AskUserBasic } from "./ask-user-basic";
import { AttachmentsBasic } from "./attachments-basic";
import { ChipBasic } from "./chip-basic";
import { CommandsBasic } from "./commands-basic";
import { ComposerBasic } from "./composer-basic";
import { ComposerCommands } from "./composer-commands";
import { MessageBasic } from "./message-basic";
import { ReasoningBasic } from "./reasoning-basic";
import { StepQueueBasic } from "./step-queue-basic";
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
  "thread-basic": { Component: ThreadBasic, file: `${dir}/thread-basic.tsx` },
  "message-basic": { Component: MessageBasic, file: `${dir}/message-basic.tsx` },
  "chip-basic": { Component: ChipBasic, file: `${dir}/chip-basic.tsx` },
  "reasoning-basic": { Component: ReasoningBasic, file: `${dir}/reasoning-basic.tsx` },
  "steps-basic": { Component: StepsBasic, file: `${dir}/steps-basic.tsx` },
  "attachments-basic": { Component: AttachmentsBasic, file: `${dir}/attachments-basic.tsx` },
  "ask-user-basic": { Component: AskUserBasic, file: `${dir}/ask-user-basic.tsx` },
  "commands-basic": { Component: CommandsBasic, file: `${dir}/commands-basic.tsx` },
  "step-queue-basic": { Component: StepQueueBasic, file: `${dir}/step-queue-basic.tsx` },
};
