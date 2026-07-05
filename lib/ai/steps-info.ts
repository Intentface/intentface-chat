// Tool-part → timeline-step derivation. This is the app's contract with its
// own backend tools (the webSearch findings shape, the askUser output JSON),
// so it lives in the app, not the generic Steps primitive.

import type { ToolLabels } from "@intentface/chat/message-utils";
import { isToolPart, type ToolPart, type UnknownPart } from "@intentface/chat/types";
import type { AskUserInput, AskUserQuestion, StepStatus } from "@/lib/ai/types";

// ---------------------------------------------------------------------------
// Ask-user extraction — this app's askUser tool: its part type name, input
// schema, and output JSON format. Moved here from the package, which now ships
// only the generic ToolPart contract.
// ---------------------------------------------------------------------------

/** A single answered ask-user exchange with parsed questions and answers. */
export type AskUserAnswered = {
  toolCallId: string;
  questions: AskUserQuestion[];
  answers: Record<string, string>;
};

/** Ask-user tool call info for a message. */
export type AskUserInfo = {
  /** True when at least one ask-user tool is waiting for user input. */
  isAwaitingInput: boolean;
  /** Answered ask-user exchanges with parsed Q&A pairs. */
  answered: AskUserAnswered[];
};

/**
 * Extracts askUser tool parts and returns structured info: whether any are
 * awaiting input, and parsed Q&A pairs for answered ones.
 */
export const getAskUserInfo = (allParts: readonly UnknownPart[]): AskUserInfo => {
  const parts = allParts.filter(
    (p): p is ToolPart =>
      isToolPart(p) &&
      p.type === "tool-askUser" &&
      (p.state === "input-available" || p.state === "output-available"),
  );

  const answered: AskUserAnswered[] = parts
    .filter((p) => p.state === "output-available")
    .map((p) => {
      const input = p.input as AskUserInput | undefined;
      let answers: Record<string, string> = {};
      try {
        answers = JSON.parse(p.output as string) as Record<string, string>;
      } catch (error) {
        console.error("Failed to parse askUser output", {
          output: p.output,
          error,
        });
      }
      return {
        toolCallId: p.toolCallId,
        questions: input?.questions ?? [],
        answers,
      };
    });

  return {
    isAwaitingInput: parts.some((p) => p.state === "input-available"),
    answered,
  };
};

type WebSearchFinding = {
  claim: string;
  sources: { url: string; title: string }[];
};

export type ToolCallInfo = {
  label: string;
  status: StepStatus;
  summary: string | null;
  sources: { url: string; title: string; domain: string }[];
};

export const getToolCallInfo = (part: ToolPart, labels: ToolLabels = {}): ToolCallInfo => {
  const input = (part.input as Record<string, unknown>) ?? {};
  const isActive = part.state === "input-streaming" || part.state === "input-available";
  const isComplete = part.state === "output-available";
  const name = part.type.replace("tool-", "");

  const labelConfig = labels[name];
  const label = labelConfig
    ? isActive
      ? labelConfig.active(input)
      : labelConfig.complete(input)
    : isActive
      ? `Running ${name}`
      : `Ran ${name}`;

  const status: StepStatus = isActive ? "active" : isComplete ? "complete" : "pending";

  // Extract summary from tool output
  const output = isComplete ? (part.output as Record<string, unknown>) : null;
  const summary = typeof output?.summary === "string" ? output.summary : null;

  // Flatten sources from web search findings
  const rawOutput = isComplete && part.type === "tool-webSearch" ? part.output : null;
  const findings = Array.isArray(rawOutput) ? (rawOutput as WebSearchFinding[]) : [];
  const sources = findings
    .flatMap((f) => f.sources)
    .map((s) => {
      try {
        return { ...s, domain: new URL(s.url).hostname.replace(/^www\./, "") };
      } catch {
        return { ...s, domain: s.title };
      }
    });

  return { label, status, summary, sources };
};

export type AskUserStepInfo = {
  label: string;
  status: StepStatus;
  questions: AskUserQuestion[];
  answers: Record<string, string>;
  isComplete: boolean;
};

export const getAskUserStepInfo = (part: ToolPart): AskUserStepInfo => {
  const isComplete = part.state === "output-available";
  const input = part.input as AskUserInput | undefined;
  const questions: AskUserQuestion[] = input?.questions ?? [];

  let answers: Record<string, string> = {};
  if (isComplete) {
    try {
      answers = JSON.parse(part.output as string) as Record<string, string>;
    } catch (error) {
      console.error("Failed to parse askUser output", { output: part.output, error });
    }
  }

  const count = questions.length;
  const label = `Answered ${count} ${count === 1 ? "question" : "questions"}`;

  return { label, status: isComplete ? "complete" : "active", questions, answers, isComplete };
};
