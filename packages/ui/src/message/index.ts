// Public surface of @intentface/ui/message. No directive — see index.parts.ts.

export * as Message from "./index.parts";
export type {
  MessageChipSegment,
  MessageRootProps,
  MessageSelection,
  MessageState,
  MessageTextProps,
  MessageTurnProps,
} from "./message";
export {
  readMessageSelection,
  useMessageSelection,
  useMessageSelectionScope,
} from "./message";
