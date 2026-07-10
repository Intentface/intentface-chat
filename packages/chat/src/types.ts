// Structural message contract. These types are deliberately framework- and
// SDK-agnostic: an AI SDK `UIMessage` satisfies `ChatMessage` structurally, so
// no adapter or translation layer is needed. Extend via the generics.

// Every primitive stamps a bespoke part-identity attribute (data-composer-root,
// data-thread-scroller, …) — `data-slot` stays free for the consumer layer.
// Declared on React's HTMLAttributes so internal props objects typecheck —
// TS only special-cases data-* attributes inside JSX literals, not in plain
// object literals handed to the render machinery.
declare module "react" {
  // biome-ignore lint/correctness/noUnusedVariables: augmentation must repeat React's type parameter
  interface HTMLAttributes<T> {
    [dataAttribute: `data-${string}`]: string | undefined;
  }
}

/**
 * The minimal part contract. Every part has a `type`; parts this package does
 * not understand (e.g. `step-start`, `dynamic-tool`, future additions) are
 * carried through untouched.
 */
export type UnknownPart = { type: string };

export type TextPart = {
  type: "text";
  text: string;
  state?: "streaming" | "done";
};

export type ReasoningPart = {
  type: "reasoning";
  text: string;
  state?: "streaming" | "done";
};

export type FilePart = {
  type: "file";
  mediaType: string;
  url: string;
  filename?: string;
};

export type SourceUrlPart = {
  type: "source-url";
  sourceId: string;
  url: string;
  title?: string;
};

export type ToolPartState =
  | "input-streaming"
  | "input-available"
  | "output-available"
  | "output-error";

export type ToolPart<Input = unknown, Output = unknown> = {
  type: `tool-${string}`;
  toolCallId: string;
  state: ToolPartState;
  input?: Input;
  output?: Output;
  errorText?: string;
};

export type DataPart = {
  type: `data-${string}`;
  id?: string;
  data?: unknown;
};

export type MessagePart =
  | TextPart
  | ReasoningPart
  | FilePart
  | SourceUrlPart
  | ToolPart
  | DataPart
  | UnknownPart;

export type ChatMessage<Metadata = unknown, Part extends UnknownPart = MessagePart> = {
  id: string;
  // Opaque role string — consumers own the concrete union (e.g. system/user/
  // assistant). AI SDK message shapes satisfy this structurally.
  role: string;
  metadata?: Metadata;
  parts: Part[];
};

/** Structurally identical to the AI SDK's `ChatStatus`. */
export type ChatStatus = "submitted" | "streaming" | "ready" | "error";

// ---------------------------------------------------------------------------
// Ask-user contract
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Part guards
//
// `UnknownPart` sits in the `MessagePart` union, so a raw discriminant check
// (`part.type === "text"`) cannot narrow. Use these guards instead.
// ---------------------------------------------------------------------------

export const isTextPart = (part: UnknownPart): part is TextPart => part.type === "text";

export const isReasoningPart = (part: UnknownPart): part is ReasoningPart =>
  part.type === "reasoning";

export const isFilePart = (part: UnknownPart): part is FilePart => part.type === "file";

export const isSourceUrlPart = (part: UnknownPart): part is SourceUrlPart =>
  part.type === "source-url";

export const isToolPart = (part: UnknownPart): part is ToolPart =>
  part.type.startsWith("tool-") && "state" in part && "toolCallId" in part;
