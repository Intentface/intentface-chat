"use client";

// App-owned composer panel derivation: maps the message list + chat status to
// the composer panel's state (idle / active steps). This is product policy —
// which steps to show, how to label them, which tools are routed elsewhere —
// so it lives in the app, built on the package's generic part contracts.

import {
  type ChatMessage,
  type ChatStatus,
  isReasoningPart,
  isToolPart,
  type ToolPart,
} from "@intentface/chat/types";
import { useRef } from "react";
import type { ToolLabels } from "@/lib/ai/tool-labels";

// Tools this app routes to their own panel (the ask-user overlay in
// components/chat.tsx) instead of the generic step list.
const EXCLUDED_PART_TYPES = ["tool-askUser"];

// ---------------------------------------------------------------------------
// State types
// ---------------------------------------------------------------------------

export type ComposerStepItem = {
  key: string;
  label: string;
  kind: "thinking" | "tool";
};

export type ComposerPanelState = { type: "idle" } | { type: "active"; steps: ComposerStepItem[] };

// ---------------------------------------------------------------------------
// Structural equality — avoids new object refs when nothing changed
// ---------------------------------------------------------------------------

const stateEqual = (a: ComposerPanelState, b: ComposerPanelState): boolean => {
  if (a.type !== b.type) return false;
  if (a.type === "idle") return true;
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
  const lastAssistant = messages.findLast((m) => m.role === "assistant");

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

  const parts = lastAssistant.parts.filter((p) => !EXCLUDED_PART_TYPES.includes(p.type));

  // 1. Check for active tool parts (input-streaming / input-available)
  const toolParts = parts.filter(
    (p): p is ToolPart =>
      isToolPart(p) &&
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

  // 2. Check if last part is reasoning
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

  // 3. Last part is text (user sees inline) → idle
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
