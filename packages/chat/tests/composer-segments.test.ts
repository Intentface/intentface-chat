import { describe, expect, test } from "bun:test";
import { parseChipSegments } from "../src/chip-markdown";
import {
  diffFlatText,
  documentLength,
  getPlainText,
  lineBoundsAt,
  mapPosition,
  mapPositionResult,
  planBeforeInput,
  type SegmentDoc,
  segmentsFromParagraphJSON,
  segmentsToParagraphJSON,
  serializeSegments,
  sliceSegments,
  spliceSegments,
  type TextChange,
  toScanText,
  truncateToFit,
} from "../src/composer/segments";

const chip = (id: string, value: string, extra: Partial<{ icon: string }> = {}) =>
  ({
    type: "chip",
    id,
    chip: { prefix: "@", value, label: value, ...extra },
  }) as const;

const text = (t: string) => ({ type: "text", text: t }) as const;

describe("projections", () => {
  const doc: SegmentDoc = [text("hi "), chip("c1", "rasmus"), text(" there\nline2")];

  test("documentLength counts chars + 1 per chip", () => {
    expect(documentLength(doc)).toBe(3 + 1 + 12);
  });

  test("getPlainText omits chips", () => {
    expect(getPlainText(doc)).toBe("hi  there\nline2");
  });

  test("toScanText renders chips as a space (positions stay 1:1)", () => {
    expect(toScanText(doc)).toBe("hi   there\nline2");
    expect(toScanText(doc).length).toBe(documentLength(doc));
  });

  test("lineBoundsAt finds the newline-delimited line", () => {
    const scan = "abc\ndef\ngh";
    expect(lineBoundsAt(scan, 0)).toEqual({ lineStart: 0, lineEnd: 3 });
    expect(lineBoundsAt(scan, 5)).toEqual({ lineStart: 4, lineEnd: 7 });
    expect(lineBoundsAt(scan, 9)).toEqual({ lineStart: 8, lineEnd: 10 });
  });
});

describe("serializeSegments", () => {
  test("byte-parity with the legacy serializeDocument fixture", () => {
    const doc: SegmentDoc = [
      text("look at "),
      {
        type: "chip",
        id: "c1",
        chip: { prefix: "file", value: "report.pdf", label: "report.pdf", icon: "fileText" },
      },
      text("\nsecond line"),
    ];
    expect(serializeSegments(doc).text).toBe(
      "look at [report.pdf](chip:file:report.pdf?icon=fileText)\nsecond line",
    );
  });

  test("round-trips through parseChipSegments", () => {
    const doc: SegmentDoc = [
      {
        type: "chip",
        id: "c1",
        chip: { prefix: "tool", value: "web-search", label: "Web search", icon: "globe" },
      },
    ];
    expect(parseChipSegments(serializeSegments(doc).text)).toEqual([
      { type: "chip", label: "Web search", prefix: "tool", value: "web-search", icon: "globe" },
    ]);
  });
});

describe("spliceSegments", () => {
  test("splits text at range boundaries and merges the result", () => {
    const doc: SegmentDoc = [text("hello world")];
    expect(spliceSegments(doc, 5, 6, [text("-")])).toEqual([text("hello-world")]);
  });

  test("removes a chip only when the range covers it", () => {
    const doc: SegmentDoc = [text("a"), chip("c1", "x"), text("b")];
    // Range [1,2) covers the chip.
    expect(spliceSegments(doc, 1, 2, [])).toEqual([text("ab")]);
    // Collapsed edge at the chip boundary leaves it alone.
    expect(spliceSegments(doc, 1, 1, [text("!")])).toEqual([
      text("a!"),
      chip("c1", "x"),
      text("b"),
    ]);
  });

  test("drops empty text and merges adjacent text segments", () => {
    const doc: SegmentDoc = [text("ab"), chip("c1", "x"), text("cd")];
    expect(spliceSegments(doc, 2, 3, [])).toEqual([text("abcd")]);
  });

  test("insert at end appends", () => {
    expect(spliceSegments([text("ab")], 2, 2, [chip("c1", "x")])).toEqual([
      text("ab"),
      chip("c1", "x"),
    ]);
  });
});

describe("sliceSegments", () => {
  const doc: SegmentDoc = [text("ab"), chip("c1", "x"), text("cd")];

  test("extracts text and whole chips", () => {
    expect(sliceSegments(doc, 1, 4)).toEqual([text("b"), chip("c1", "x"), text("c")]);
  });

  test("excludes a chip outside the range", () => {
    expect(sliceSegments(doc, 3, 5)).toEqual([text("cd")]);
  });
});

describe("truncateToFit", () => {
  test("slices text at the boundary", () => {
    expect(truncateToFit([text("abcdef")], 3)).toEqual([text("abc")]);
  });

  test("drops a chip that does not fit whole", () => {
    expect(truncateToFit([text("ab"), chip("c1", "x"), text("cd")], 2)).toEqual([text("ab")]);
    expect(truncateToFit([text("ab"), chip("c1", "x"), text("cd")], 3)).toEqual([
      text("ab"),
      chip("c1", "x"),
    ]);
  });
});

describe("mapPosition", () => {
  const insertAt5: TextChange = { rangeStart: 5, rangeEnd: 5, insertedLength: 3 };
  const delete2to5: TextChange = { rangeStart: 2, rangeEnd: 5, insertedLength: 0 };
  const replace2to5with1: TextChange = { rangeStart: 2, rangeEnd: 5, insertedLength: 1 };

  test("positions before the change are unchanged", () => {
    expect(mapPosition(1, insertAt5, 1)).toBe(1);
    expect(mapPosition(1, delete2to5, -1)).toBe(1);
  });

  test("positions after the change shift by the size delta", () => {
    expect(mapPosition(8, insertAt5, -1)).toBe(11);
    expect(mapPosition(8, delete2to5, -1)).toBe(5);
    expect(mapPosition(8, replace2to5with1, 1)).toBe(6);
  });

  test("insertion exactly at the position respects bias (token start holds, end grows)", () => {
    expect(mapPosition(5, insertAt5, -1)).toBe(5);
    expect(mapPosition(5, insertAt5, 1)).toBe(8);
  });

  test("positions inside a deleted range collapse and report deleted", () => {
    expect(mapPositionResult(3, delete2to5, -1)).toEqual({ position: 2, deleted: true });
    expect(mapPositionResult(3, replace2to5with1, 1)).toEqual({ position: 3, deleted: true });
  });

  test("range end with left bias reports deleted for a real deletion", () => {
    expect(mapPositionResult(5, delete2to5, -1)).toEqual({ position: 2, deleted: true });
    expect(mapPositionResult(5, insertAt5, -1)).toEqual({ position: 5, deleted: false });
  });
});

describe("diffFlatText", () => {
  test("identical strings diff to null", () => {
    expect(diffFlatText("abc", "abc")).toBeNull();
  });

  test("typing in the middle", () => {
    expect(diffFlatText("ac", "abc", 2)).toEqual({
      rangeStart: 1,
      rangeEnd: 1,
      insertedLength: 1,
    });
  });

  test("deletion", () => {
    expect(diffFlatText("abc", "ac", 1)).toEqual({
      rangeStart: 1,
      rangeEnd: 2,
      insertedLength: 0,
    });
  });

  test("replacement", () => {
    expect(diffFlatText("abcd", "aXYd", 3)).toEqual({
      rangeStart: 1,
      rangeEnd: 3,
      insertedLength: 2,
    });
  });

  test("repeated-character run resolves toward the caret", () => {
    // "aa" → "aaa" typed at position 1: without a hint the diff is ambiguous;
    // the caret hint pins the inserted char so it ends at the caret.
    expect(diffFlatText("aa", "aaa", 1)).toEqual({
      rangeStart: 0,
      rangeEnd: 0,
      insertedLength: 1,
    });
    expect(diffFlatText("aa", "aaa", 3)).toEqual({
      rangeStart: 2,
      rangeEnd: 2,
      insertedLength: 1,
    });
  });

  test("chip sentinels participate in positions", () => {
    expect(diffFlatText("a￼b", "a￼xb", 3)).toEqual({
      rangeStart: 2,
      rangeEnd: 2,
      insertedLength: 1,
    });
  });
});

describe("planBeforeInput", () => {
  const doc: SegmentDoc = [text("ab"), chip("c1", "x"), text("cd")];
  const caret = (position: number) => ({ start: position, end: position });

  test("plain text insert is native", () => {
    expect(
      planBeforeInput({
        inputType: "insertText",
        data: "z",
        targetRange: caret(1),
        doc,
        caret: caret(1),
      }),
    ).toEqual({ kind: "native" });
  });

  test("composition text is always native (guard owns it)", () => {
    expect(
      planBeforeInput({
        inputType: "insertCompositionText",
        data: "か",
        targetRange: null,
        doc,
        caret: caret(1),
      }),
    ).toEqual({ kind: "native" });
  });

  test("undo/redo and formatting are blocked", () => {
    for (const inputType of [
      "historyUndo",
      "historyRedo",
      "formatBold",
      "insertFromDrop",
      "deleteByDrag",
      "insertOrderedList",
    ]) {
      expect(
        planBeforeInput({ inputType, data: null, targetRange: null, doc, caret: caret(0) }),
      ).toEqual({ kind: "block" });
    }
  });

  test("delete touching a chip becomes a splice", () => {
    expect(
      planBeforeInput({
        inputType: "deleteContentBackward",
        data: null,
        targetRange: { start: 2, end: 3 },
        doc,
        caret: caret(3),
      }),
    ).toEqual({ kind: "splice", from: 2, to: 3, insert: [], caret: 2 });
  });

  test("delete not touching a chip stays native", () => {
    expect(
      planBeforeInput({
        inputType: "deleteContentBackward",
        data: null,
        targetRange: { start: 1, end: 2 },
        doc,
        caret: caret(2),
      }),
    ).toEqual({ kind: "native" });
  });

  test("type-over selection covering a chip becomes a splice", () => {
    expect(
      planBeforeInput({
        inputType: "insertText",
        data: "z",
        targetRange: { start: 0, end: 5 },
        doc,
        caret: { start: 0, end: 5 },
      }),
    ).toEqual({
      kind: "splice",
      from: 0,
      to: 5,
      insert: [text("z")],
      caret: 1,
    });
  });

  test("insertParagraph is emulated as a soft break", () => {
    expect(
      planBeforeInput({
        inputType: "insertParagraph",
        data: null,
        targetRange: caret(2),
        doc,
        caret: caret(2),
      }),
    ).toEqual({ kind: "splice", from: 2, to: 2, insert: [text("\n")], caret: 3 });
  });

  test("maxLength blocks a full doc and truncates a partial fit", () => {
    // doc length is 5.
    expect(
      planBeforeInput({
        inputType: "insertText",
        data: "z",
        targetRange: caret(5),
        doc,
        caret: caret(5),
        maxLength: 5,
      }),
    ).toEqual({ kind: "block" });
    expect(
      planBeforeInput({
        inputType: "insertText",
        data: "xyz",
        targetRange: caret(5),
        doc,
        caret: caret(5),
        maxLength: 7,
      }),
    ).toEqual({ kind: "splice", from: 5, to: 5, insert: [text("xy")], caret: 7 });
  });
});

describe("paragraph JSON snapshot round-trip", () => {
  test("multi-line docs with chips survive the round trip", () => {
    const doc: SegmentDoc = [
      text("hello "),
      chip("c1", "rasmus", { icon: "user" }),
      text("\nsecond\n\nfourth"),
    ];
    let id = 0;
    const roundTripped = segmentsFromParagraphJSON(segmentsToParagraphJSON(doc), () => `c${++id}`);
    expect(getPlainText(roundTripped)).toBe(getPlainText(doc));
    expect(serializeSegments(roundTripped).text).toBe(serializeSegments(doc).text);
  });

  test("paragraph boundaries map to newlines", () => {
    expect(segmentsToParagraphJSON([text("a\nb")])).toEqual([
      { type: "paragraph", content: [{ type: "text", text: "a" }] },
      { type: "paragraph", content: [{ type: "text", text: "b" }] },
    ]);
  });
});
