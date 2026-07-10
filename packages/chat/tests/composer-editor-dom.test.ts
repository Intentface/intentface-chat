import { describe, expect, test } from "bun:test";
import type { ChipData } from "../src/chip-markdown";
import {
  type DomNodeSpec,
  documentToDomSpec,
  logicalRangeFromDom,
  type ReadableNode,
  readDocumentFromDom,
} from "../src/composer/editor-dom";
import type { SegmentDoc } from "../src/composer/segments";

// Structural stand-ins for DOM nodes — the reader and position mapping only
// walk nodeType / nodeName / data / childNodes / getAttribute (the
// SerializableNode precedent from composer-document.test.ts).

const textNode = (data: string): ReadableNode => ({
  nodeType: 3,
  nodeName: "#text",
  data,
  childNodes: [],
});

const element = (
  nodeName: string,
  attrs: Record<string, string>,
  ...children: ReadableNode[]
): ReadableNode => ({
  nodeType: 1,
  nodeName,
  childNodes: children,
  getAttribute: (name: string) => attrs[name] ?? null,
});

const br = () => element("BR", {});
const chipSpan = (id: string) => element("SPAN", { "data-chip-id": id, "data-mention-chip": "" });
const badgeSpan = (...children: ReadableNode[]) =>
  element("SPAN", { "data-command-badge": "" }, ...children);
const editorRoot = (...children: ReadableNode[]) => element("DIV", {}, ...children);

const CHIPS = {
  c1: { prefix: "@", value: "rasmus", label: "rasmus" } satisfies ChipData,
};
const resolveChip = (id: string) => (CHIPS as Record<string, ChipData>)[id] ?? null;

describe("readDocumentFromDom", () => {
  test("fragmented text nodes concatenate into one segment", () => {
    const { doc, dirty } = readDocumentFromDom(
      editorRoot(textNode("hel"), textNode("lo")),
      resolveChip,
    );
    expect(doc).toEqual([{ type: "text", text: "hello" }]);
    expect(dirty).toBe(false);
  });

  test("NBSP reads as a plain space", () => {
    const { doc } = readDocumentFromDom(editorRoot(textNode("a\u00A0b")), resolveChip);
    expect(doc).toEqual([{ type: "text", text: "a b" }]);
  });

  test("the padding <br> protocol round-trips", () => {
    // "" ↔ <br>
    expect(readDocumentFromDom(editorRoot(br()), resolveChip).doc).toEqual([]);
    // "a\n" ↔ a<br><br>
    expect(readDocumentFromDom(editorRoot(textNode("a"), br(), br()), resolveChip).doc).toEqual([
      { type: "text", text: "a\n" },
    ]);
    // Ghost line after a native edit: a<br> reads as "a" (self-heals next keystroke).
    expect(readDocumentFromDom(editorRoot(textNode("a"), br()), resolveChip).doc).toEqual([
      { type: "text", text: "a" },
    ]);
  });

  test("badge spans are transparent wrappers", () => {
    const { doc, dirty } = readDocumentFromDom(
      editorRoot(textNode("hi "), badgeSpan(textNode("@ra")), textNode(" end")),
      resolveChip,
    );
    expect(doc).toEqual([{ type: "text", text: "hi @ra end" }]);
    expect(dirty).toBe(false);
  });

  test("chips resolve through the registry; content is never read", () => {
    const withLabel = element("SPAN", { "data-chip-id": "c1" }, textNode("visual label — ignored"));
    const { doc } = readDocumentFromDom(editorRoot(textNode("a"), withLabel), resolveChip);
    expect(doc).toEqual([
      { type: "text", text: "a" },
      { type: "chip", id: "c1", chip: CHIPS.c1 },
    ]);
  });

  test("unknown chip ids mark the document dirty and are skipped", () => {
    const { doc, dirty } = readDocumentFromDom(
      editorRoot(textNode("a"), chipSpan("zombie")),
      resolveChip,
    );
    expect(doc).toEqual([{ type: "text", text: "a" }]);
    expect(dirty).toBe(true);
  });

  test("a duplicated chip id gets a fresh identity", () => {
    let id = 0;
    const { doc } = readDocumentFromDom(
      editorRoot(chipSpan("c1"), chipSpan("c1")),
      resolveChip,
      () => `fresh-${++id}`,
    );
    expect(doc).toEqual([
      { type: "chip", id: "c1", chip: CHIPS.c1 },
      { type: "chip", id: "fresh-1", chip: CHIPS.c1 },
    ]);
  });

  test("block elements read through but flag dirty", () => {
    const { doc, dirty } = readDocumentFromDom(
      editorRoot(textNode("a"), element("DIV", {}, textNode("b"))),
      resolveChip,
    );
    expect(doc).toEqual([{ type: "text", text: "ab" }]);
    expect(dirty).toBe(true);
  });
});

describe("documentToDomSpec", () => {
  test("empty document renders a lone padding <br>", () => {
    expect(documentToDomSpec([])).toEqual([{ kind: "br", padding: true }]);
  });

  test("trailing newline gets a padding <br>", () => {
    expect(documentToDomSpec([{ type: "text", text: "a\n" }])).toEqual([
      { kind: "text", text: "a" },
      { kind: "br", padding: false },
      { kind: "br", padding: true },
    ]);
  });

  test("chips interleave with text", () => {
    const doc: SegmentDoc = [
      { type: "text", text: "hi " },
      { type: "chip", id: "c1", chip: CHIPS.c1 },
      { type: "text", text: "!" },
    ];
    expect(documentToDomSpec(doc)).toEqual([
      { kind: "text", text: "hi " },
      { kind: "chip", id: "c1" },
      { kind: "text", text: "!" },
    ]);
  });

  test("write → read round-trips", () => {
    const materialize = (spec: DomNodeSpec): ReadableNode => {
      switch (spec.kind) {
        case "text":
          return textNode(spec.text);
        case "br":
          return br();
        case "chip":
          return chipSpan(spec.id);
      }
    };
    const docs: SegmentDoc[] = [
      [],
      [{ type: "text", text: "hello" }],
      [{ type: "text", text: "a\nb\n\nc" }],
      [{ type: "text", text: "a\n" }],
      [
        { type: "text", text: "hi " },
        { type: "chip", id: "c1", chip: CHIPS.c1 },
        { type: "text", text: "\nnext" },
      ],
      [{ type: "chip", id: "c1", chip: CHIPS.c1 }],
    ];
    for (const doc of docs) {
      const rendered = editorRoot(...documentToDomSpec(doc).map(materialize));
      expect(readDocumentFromDom(rendered, resolveChip).doc).toEqual(doc);
    }
  });
});

describe("logicalRangeFromDom", () => {
  const hi = textNode("hi ");
  const tail = textNode(" end");
  const chip = chipSpan("c1");
  const root = editorRoot(hi, chip, tail);

  test("text node offsets map directly", () => {
    expect(logicalRangeFromDom(root, hi, 0)).toBe(0);
    expect(logicalRangeFromDom(root, hi, 3)).toBe(3);
    expect(logicalRangeFromDom(root, tail, 1)).toBe(5);
  });

  test("element points count preceding children", () => {
    expect(logicalRangeFromDom(root, root, 0)).toBe(0);
    expect(logicalRangeFromDom(root, root, 1)).toBe(3);
    expect(logicalRangeFromDom(root, root, 2)).toBe(4);
    expect(logicalRangeFromDom(root, root, 3)).toBe(8);
  });

  test("a point inside a chip clamps to the chip start", () => {
    const label = textNode("rasmus");
    const chipWithContent = element("SPAN", { "data-chip-id": "c1" }, label);
    const contentRoot = editorRoot(textNode("ab"), chipWithContent);
    expect(logicalRangeFromDom(contentRoot, label, 3)).toBe(2);
    expect(logicalRangeFromDom(contentRoot, chipWithContent, 0)).toBe(2);
  });

  test("points inside a badge span read through it", () => {
    const inner = textNode("@ra");
    const badged = editorRoot(textNode("hi "), badgeSpan(inner));
    expect(logicalRangeFromDom(badged, inner, 2)).toBe(5);
  });

  test("<br> counts one position", () => {
    const after = textNode("b");
    const withBreak = editorRoot(textNode("a"), br(), after);
    expect(logicalRangeFromDom(withBreak, after, 0)).toBe(2);
  });

  test("a node outside the root returns null", () => {
    expect(logicalRangeFromDom(root, textNode("elsewhere"), 0)).toBeNull();
  });
});

describe("presentation-only elements (badge hint)", () => {
  const hintSpan = (text: string) =>
    element("SPAN", { "data-command-hint": "", contenteditable: "false" }, textNode(text));

  test("the reader skips hint content without flagging dirty", () => {
    const { doc, dirty } = readDocumentFromDom(
      editorRoot(textNode("hi "), badgeSpan(textNode("@ra"), hintSpan("smus"))),
      resolveChip,
    );
    expect(doc).toEqual([{ type: "text", text: "hi @ra" }]);
    expect(dirty).toBe(false);
  });

  test("hints are zero-width for position mapping; points inside clamp", () => {
    const hintLabel = textNode("smus");
    const hint = element(
      "SPAN",
      { "data-command-hint": "", contenteditable: "false" },
      hintLabel,
    );
    const after = textNode(" end");
    const root = editorRoot(textNode("hi "), badgeSpan(textNode("@ra"), hint), after);
    // Text after the badge starts at 6 ("hi @ra") — the hint contributes 0.
    expect(logicalRangeFromDom(root, after, 0)).toBe(6);
    // A point inside the hint clamps to its boundary.
    expect(logicalRangeFromDom(root, hintLabel, 2)).toBe(6);
  });
});
