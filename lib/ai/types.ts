import type { ChatMessage, ChatStatus, FilePart } from "@intentface/chat/types";
import type * as sdk from "ai";

export type AppUIMessage = sdk.UIMessage<{
  stopped?: boolean;
}>;

// The ask-user contract lives in the headless package; this app consumes it
// from here so UI code has a single import boundary.
export type { AskUserInput, AskUserOption, AskUserQuestion } from "@intentface/chat/types";

// ---------------------------------------------------------------------------
// Assignability locks
//
// @intentface/chat owns structural message types that AI SDK shapes must keep
// satisfying. These asserts fail typecheck loudly if an `ai` upgrade (or a
// package change) breaks that structural compatibility.
// ---------------------------------------------------------------------------

type Assert<T extends true> = T;

export type MessageContractCheck = Assert<
  AppUIMessage extends ChatMessage<{ stopped?: boolean }> ? true : false
>;

export type FilePartContractCheck = Assert<sdk.FileUIPart extends FilePart ? true : false>;

export type ChatStatusContractCheck = Assert<sdk.ChatStatus extends ChatStatus ? true : false>;
