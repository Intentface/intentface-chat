import type { ChatMessage, ChatStatus, FilePart } from "@intentface/chat/types";
import type * as sdk from "ai";

export type AppUIMessage = sdk.UIMessage<
  { stopped?: boolean },
  // Transient stream-only parts (delivered via onData, never persisted into
  // message.parts): the server pushes the generated thread title mid-stream.
  { "thread-title": { title: string } }
>;

// This app's askUser tool contract — the tool's input wire shape. The app owns
// it (the zod schema in tools/ask-user.ts is the source of truth); the
// composer's generic question contract is satisfied structurally (see the
// assignability lock below).
export type AskUserOption = {
  label: string;
  description: string;
};

export type AskUserQuestion = {
  question: string;
  header?: string;
  options: AskUserOption[];
  multiSelect?: boolean;
};

export type AskUserInput = {
  questions: AskUserQuestion[];
};

// This app's concrete message roles. The headless Message primitive takes an
// opaque role string; the app owns the set.
export type MessageRole = "system" | "user" | "assistant";

// This app's concrete step statuses. The headless Steps primitive takes an
// opaque status string; the app owns the set.
export type StepStatus = "complete" | "active" | "pending" | "error";

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

// No assignability lock for the composer's `requests` prop: ComposerRequest
// requires a consumer-minted `id`, so tool questions are mapped explicitly at
// the boundary (useAskUserPanelState in components/chat.tsx) rather than
// passed through structurally.
