"use client";

// Derives the composer panel's state (idle / active steps / ask-user) from the
// message list and chat status. Pure derivation plus a memoizing hook — no
// rendering, no styling.

import { useRef } from "react";
import type { ToolLabels } from "./message-utils";
import {
  type AskUserInput,
  type AskUserQuestion,
  type ChatMessage,
  type ChatStatus,
  isReasoningPart,
  isToolPart,
  type ToolPart,
} from "./types";

// ---------------------------------------------------------------------------
// State types
// ---------------------------------------------------------------------------

export type ComposerStepItem = {
  key: string;
  label: string;
  kind: "thinking" | "tool";
};

export type ComposerPanelState =
  | { type: "idle" }
  | { type: "active"; steps: ComposerStepItem[] }
  | {
      type: "ask-user";
      toolCallId: string;
      questions: AskUserQuestion[];
      isAnswered: boolean;
    };

// ---------------------------------------------------------------------------
// Structural equality — avoids new object refs when nothing changed
// ---------------------------------------------------------------------------

const stateEqual = (a: ComposerPanelState, b: ComposerPanelState): boolean => {
  if (a.type !== b.type) return false;
  if (a.type === "idle") return true;
  if (a.type === "ask-user" && b.type === "ask-user")
    return a.toolCallId === b.toolCallId && a.isAnswered === b.isAnswered;
  if (a.type === "active" && b.type === "active") {
    if (a.steps.length !== b.steps.length) return false;
    return a.steps.every((step, index) => {
      const other = b.steps[index];
      return other !== undefined && step.key === other.key && step.label === other.label;
    });
  }
  return false;
};

// ---------------------------------------------------------------------------
// Pure derivation — no hooks
// ---------------------------------------------------------------------------

const deriveComposerState = (
  messages: readonly ChatMessage[],
  status: ChatStatus,
  labels?: ToolLabels,
): ComposerPanelState => {
  const lastAssistant = [...messages].reverse().find((m) => m.role === "assistant");

  // Check for ask-user awaiting input regardless of status — the chat goes
  // "ready" while the tool waits for user input, so we must detect it early.
  if ((status === "ready" || status === "streaming") && lastAssistant) {
    const askUserPart = lastAssistant.parts.find(
      (p): p is ToolPart =>
        isToolPart(p) && p.type === "tool-askUser" && p.state === "input-available",
    );
    if (askUserPart) {
      const input = askUserPart.input as AskUserInput | undefined;
      return {
        type: "ask-user",
        toolCallId: askUserPart.toolCallId,
        questions: input?.questions ?? [],
        isAnswered: false,
      };
    }
  }

  // Idle / error → idle
  if (status === "ready" || status === "error") {
    return { type: "idle" };
  }

  // Submitted but no streaming yet → loading (single thinking step)
  if (status === "submitted") {
    return {
      type: "active",
      steps: [{ key: "thinking", label: "Thinking...", kind: "thinking" }],
    };
  }

  // status === "streaming" — scan the last assistant message
  if (!lastAssistant) {
    return {
      type: "active",
      steps: [{ key: "thinking", label: "Thinking...", kind: "thinking" }],
    };
  }

  const { parts } = lastAssistant;

  // 1. Ask-user check already handled above (works for both ready + streaming)

  // 2. Check for active tool parts (input-streaming / input-available)
  const toolParts = parts.filter(
    (p): p is ToolPart =>
      isToolPart(p) &&
      p.type !== "tool-askUser" &&
      (p.state === "input-streaming" ||
        p.state === "input-available" ||
        p.state === "output-available"),
  );

  if (toolParts.length > 0) {
    // Check if any tool is still actively running
    const hasActive = toolParts.some(
      (p) => p.state === "input-streaming" || p.state === "input-available",
    );

    // Show tool-chain when a tool is active, OR when all tools are complete
    // but text output hasn't started yet (prevents the panel from flickering
    // between tool completion and the next reasoning/tool part).
    const hasTextAfterTools = !hasActive && parts.at(-1)?.type === "text";

    if (!hasTextAfterTools) {
      const steps: ComposerStepItem[] = [];

      // Prepend a completed thinking step if reasoning preceded the tools
      const hasReasoning = parts.some((p) => p.type === "reasoning");
      if (hasReasoning) {
        steps.push({
          key: "reasoning",
          label: "Thinking",
          kind: "thinking",
        });
      }

      for (const part of toolParts) {
        const input = (part.input as Record<string, unknown>) ?? {};
        const name = part.type.replace("tool-", "");

        const labelConfig = labels?.[name];
        const label = labelConfig ? labelConfig.active(input) : `Running ${name}`;

        steps.push({
          key: part.toolCallId,
          label,
          kind: "tool" as const,
        });
      }

      return { type: "active", steps };
    }
  }

  // 3. Check if last part is reasoning
  const lastPart = parts.at(-1);
  if (lastPart && isReasoningPart(lastPart)) {
    // Extract label from reasoning headers
    const headers = lastPart.text.match(/\*\*(.+?)\*\*/g)?.map((h) => h.replace(/\*\*/g, ""));
    const label = headers?.at(-1) ?? "Thinking...";

    return {
      type: "active",
      steps: [{ key: "reasoning", label, kind: "thinking" }],
    };
  }

  // 4. Last part is text (user sees inline) → idle
  return { type: "idle" };
};

// ---------------------------------------------------------------------------
// Hook — memoized to avoid new refs on every streaming chunk
// ---------------------------------------------------------------------------

export const useActiveComposerState = (
  messages: readonly ChatMessage[],
  status: ChatStatus,
  labels?: ToolLabels,
): ComposerPanelState => {
  const prevRef = useRef<ComposerPanelState>({ type: "idle" });
  const next = deriveComposerState(messages, status, labels);
  if (stateEqual(prevRef.current, next)) return prevRef.current;
  prevRef.current = next;
  return next;
};
