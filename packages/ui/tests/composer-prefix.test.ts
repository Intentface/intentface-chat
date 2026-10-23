import { describe, expect, test } from "bun:test";
import { detectActivePrefix } from "../src/composer/prefix-detection";

// Helper: build the detect args from a one-line document with a caret marker.
// "|"" marks the caret; positions are 1-based (blockStart = 1).
const argsFromLine = (
  line: string,
  registered: Parameters<typeof detectActivePrefix>[0]["registered"],
) => {
  const caret = line.indexOf("|");
  const text = line.replace("|", "");
  const blockStart = 1;
  return {
    registered,
    blockStart,
    blockEnd: blockStart + text.length,
    cursorPosition: blockStart + caret,
    textBeforeCursor: text.slice(0, caret),
    textAfterCursor: text.slice(caret),
    fullDocText: text,
  };
};

describe("detectActivePrefix", () => {
  const slash = [{ prefix: "/", triggerRule: "doc-start" as const }];
  const mention = [{ prefix: "@", triggerRule: "word-boundary" as const }];

  test("doc-start prefix opens when the document starts with it", () => {
    const state = detectActivePrefix(argsFromLine("/sum|mary", slash));
    expect(state.isOpen).toBe(true);
    expect(state.trigger).toBe("/");
    expect(state.query).toBe("summary");
  });

  test("doc-start prefix stays closed mid-document", () => {
    const state = detectActivePrefix(argsFromLine("hello /sum|", slash));
    expect(state.isOpen).toBe(false);
  });

  test("word-boundary prefix opens at line start", () => {
    const state = detectActivePrefix(argsFromLine("@ras|", mention));
    expect(state.isOpen).toBe(true);
    expect(state.query).toBe("ras");
  });

  test("word-boundary prefix opens after a space and spans the whole token", () => {
    const state = detectActivePrefix(argsFromLine("hi @ras|mus", mention));
    expect(state.isOpen).toBe(true);
    // Query covers both sides of the caret — the token is treated whole.
    expect(state.query).toBe("rasmus");
    expect(state.triggerEndPosition - state.triggerStartPosition).toBe("@rasmus".length);
  });

  test("prefix glued to a word does not trigger", () => {
    const state = detectActivePrefix(argsFromLine("email@exam|ple", mention));
    expect(state.isOpen).toBe(false);
  });

  test("no registered prefixes → closed", () => {
    const state = detectActivePrefix(argsFromLine("@ras|", []));
    expect(state.isOpen).toBe(false);
  });
});

// ReDoS regression: /\S*$/ took ~16s on this input before the index scan.
describe("detectActivePrefix performance", () => {
  const mention = [{ prefix: "@", triggerRule: "word-boundary" as const }];

  test("a long run followed by whitespace does not blow up", () => {
    const text = `${"a".repeat(200_000)} `;
    const args = {
      registered: mention,
      blockStart: 1,
      blockEnd: 1 + text.length,
      cursorPosition: 1 + text.length,
      textBeforeCursor: text,
      textAfterCursor: "",
      fullDocText: text,
    };

    const started = performance.now();
    const state = detectActivePrefix(args);
    const elapsed = performance.now() - started;

    expect(state.isOpen).toBe(false);
    expect(elapsed).toBeLessThan(100);
  });
});
