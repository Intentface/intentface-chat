// Public composer types — the wire-level contracts consumers interact with:
// command configs, submit payloads, the opaque editor snapshot, and the
// imperative editor/attachments APIs.

import type { AttachmentItem } from "../attachments";
import type { ChipData, ChipIconKey } from "../chip-markdown";

// The composer's ask-user question contract — the minimal shape the flow needs
// to step through questions, toggle options, and compile answers. It carries no
// app-tool schema: richer consumer types (extra fields like a tab header)
// satisfy it structurally.
export type AskUserOption = {
  label: string;
  description?: string;
};

export type AskUserQuestion = {
  question: string;
  options: AskUserOption[];
  multiSelect?: boolean;
};

export type CommandItemKind = "insert" | "execute";

export type TriggerRule = "doc-start" | "after-whitespace";

export type { ChipData };

export type ComposerEditorHandle = {
  focus: () => void;
  blur: () => void;
  clear: () => void;
  insertText: (text: string) => void;
  insertChip: (chip: ChipData) => void;
};

export type AttachmentsApi = {
  add: (files: File[] | FileList) => void;
  remove: (id: string) => void;
  openFileDialog: () => void;
};

export type PrefixOnSelectContext = {
  editor: ComposerEditorHandle;
  attachments: AttachmentsApi;
};

export type CommandItemData = {
  value: string;
  label: string;
  description?: string;
  icon?: ChipIconKey;
  keywords?: string;
  onSelect?: (context: PrefixOnSelectContext) => void;
};

export type ComposerSnapshot = {
  readonly __pmDoc: object;
  readonly __brand: "ComposerSnapshot";
};

export type ComposerMessageSubmit = {
  kind: "message";
  text: string;
  files: AttachmentItem[];
};

export type ComposerAnswerEntry =
  | { question: string; option: string }
  | { question: string; text: string }
  | { question: string; options: string[]; text: string }
  | { question: string };

export type ComposerAnswersSubmit = {
  kind: "answers";
  answers: ComposerAnswerEntry[];
};

export type ComposerSubmitData = ComposerMessageSubmit | ComposerAnswersSubmit;

export type ComposerCommandsItems =
  | CommandItemData[]
  | ((
      query: string,
      options: { signal: AbortSignal },
    ) => CommandItemData[] | Promise<CommandItemData[]>);

export type ComposerCommandsConfig = {
  kind: CommandItemKind;
  trigger: TriggerRule;
  items: ComposerCommandsItems;
};

export type ComposerCommandsMap = Record<string, ComposerCommandsConfig>;
