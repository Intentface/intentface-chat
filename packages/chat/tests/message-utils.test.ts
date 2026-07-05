import { describe, expect, test } from "bun:test";
import {
  getSegmentedParts,
  getSourcesInfo,
  groupTurns,
  splitReasoningByHeaders,
} from "../src/message-utils";
import type { ChatMessage, MessagePart } from "../src/types";

describe("getSegmentedParts", () => {
  test("groups adjacent same-typed parts and keeps chronology", () => {
    const parts: MessagePart[] = [
      { type: "reasoning", text: "thinking" },
      { type: "reasoning", text: "more" },
      { type: "tool-webSearch", toolCallId: "1", state: "output-available" },
      { type: "text", text: "answer" },
      { type: "step-start" },
    ];
    const segments = getSegmentedParts(parts);

    expect(segments.map((s) => s.type)).toEqual(["reasoning", "tool", "text"]);
    expect(segments[0]?.parts).toHaveLength(2);
  });

  test("ignores parts without state/toolCallId even when tool-prefixed", () => {
    const segments = getSegmentedParts([{ type: "tool-broken" }]);
    expect(segments).toHaveLength(0);
  });
});

describe("groupTurns", () => {
  const message = (id: string, role: ChatMessage["role"]): ChatMessage => ({
    id,
    role,
    parts: [],
  });

  test("starts a turn per user message, attaches assistant replies", () => {
    const turns = groupTurns([
      message("u1", "user"),
      message("a1", "assistant"),
      message("u2", "user"),
      message("a2", "assistant"),
      message("a3", "assistant"),
    ]);

    expect(turns.map((t) => t.key)).toEqual(["u1", "u2"]);
    expect(turns[1]?.messages.map((m) => m.id)).toEqual(["u2", "a2", "a3"]);
  });

  test("a leading assistant message still gets a turn", () => {
    const turns = groupTurns([message("a1", "assistant")]);
    expect(turns).toHaveLength(1);
    expect(turns[0]?.key).toBe("a1");
  });
});

// getAskUserInfo moved to the app (lib/ai/steps-info.ts) — ask-user extraction
// is the consumer's tool contract, not the package's.

describe("getSourcesInfo", () => {
  test("deduplicates by hostname and strips www", () => {
    const parts: MessagePart[] = [
      { type: "source-url", sourceId: "1", url: "https://www.example.com/a" },
      { type: "source-url", sourceId: "2", url: "https://example.com/b" },
      { type: "source-url", sourceId: "3", url: "not a url" },
      { type: "text", text: "ignored" },
    ];
    const info = getSourcesInfo(parts);

    expect(info.sources).toEqual([{ url: "https://www.example.com/a", domain: "example.com" }]);
    expect(info.hasSources).toBe(true);
  });
});

describe("splitReasoningByHeaders", () => {
  test("splits on standalone bold header lines", () => {
    const sections = splitReasoningByHeaders(["**Plan**\ndo things", "**Check**\nverify things"]);

    expect(sections).toEqual([
      { header: "Plan", body: "do things" },
      { header: "Check", body: "verify things" },
    ]);
  });

  test("body before any header keeps a null header", () => {
    const sections = splitReasoningByHeaders(["intro text"]);
    expect(sections).toEqual([{ header: null, body: "intro text" }]);
  });
});
