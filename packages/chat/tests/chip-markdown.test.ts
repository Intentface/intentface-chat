import { describe, expect, test } from "bun:test";
import { encodeChipMarkdown, parseChipSegments } from "../src/chip-markdown";

describe("encodeChipMarkdown / parseChipSegments round trip", () => {
  test("plain chip", () => {
    const token = encodeChipMarkdown({ prefix: "file", value: "report.pdf", label: "report.pdf" });
    expect(token).toBe("[report.pdf](chip:file:report.pdf)");

    const segments = parseChipSegments(`see ${token} for details`);
    expect(segments).toEqual([
      { type: "text", text: "see " },
      { type: "chip", label: "report.pdf", prefix: "file", value: "report.pdf" },
      { type: "text", text: " for details" },
    ]);
  });

  test("icon rides along in the token", () => {
    const token = encodeChipMarkdown({
      prefix: "tool",
      value: "web-search",
      label: "Web search",
      icon: "globe",
    });

    const segments = parseChipSegments(token);
    expect(segments).toEqual([
      {
        type: "chip",
        label: "Web search",
        prefix: "tool",
        value: "web-search",
        icon: "globe",
      },
    ]);
  });

  test("unknown token params (e.g. legacy variant) are ignored", () => {
    const segments = parseChipSegments("[Web search](chip:tool:web-search?variant=accent)");
    expect(segments).toEqual([
      { type: "chip", label: "Web search", prefix: "tool", value: "web-search" },
    ]);
  });

  test("values with special characters survive the round trip", () => {
    const token = encodeChipMarkdown({
      prefix: "query",
      value: "a & b? 100%",
      label: "a & b? 100%",
    });
    const segments = parseChipSegments(token);
    expect(segments[0]).toMatchObject({ type: "chip", value: "a & b? 100%" });
  });

  test("legacy un-encoded values do not throw", () => {
    const segments = parseChipSegments("[label](chip:file:100%raw)");
    expect(segments[0]).toMatchObject({ type: "chip", value: "100%raw" });
  });

  test("text without chips is a single text segment", () => {
    expect(parseChipSegments("no chips here")).toEqual([{ type: "text", text: "no chips here" }]);
  });
});
