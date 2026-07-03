import { describe, expect, test } from "bun:test";
import { parseChipSegments } from "../src/chip-markdown";
import { serializeDocument } from "../src/composer/document";

// Structural stand-ins for ProseMirror nodes — serializeDocument only walks
// type.name / isText / attrs / forEach.
type FakeNode = {
  isText?: boolean;
  text?: string;
  type: { name: string };
  attrs?: Record<string, unknown>;
  forEach: (callback: (child: FakeNode) => void) => void;
};

const textNode = (text: string): FakeNode => ({
  isText: true,
  text,
  type: { name: "text" },
  forEach: () => {},
});

const chipNode = (attrs: Record<string, unknown>): FakeNode => ({
  type: { name: "mentionChip" },
  attrs,
  forEach: () => {},
});

const paragraph = (...children: FakeNode[]): FakeNode => ({
  type: { name: "paragraph" },
  forEach: (cb) => children.forEach(cb),
});

const doc = (...blocks: FakeNode[]): FakeNode => ({
  type: { name: "doc" },
  forEach: (cb) => blocks.forEach(cb),
});

describe("serializeDocument", () => {
  test("text and chips serialize inline; paragraphs join with newlines", () => {
    const { text } = serializeDocument(
      doc(
        paragraph(
          textNode("look at "),
          chipNode({ prefix: "file", value: "report.pdf", label: "report.pdf", icon: "fileText" }),
        ),
        paragraph(textNode("second line")),
      ),
    );

    expect(text).toBe("look at [report.pdf](chip:file:report.pdf?icon=fileText)\nsecond line");
  });

  test("round-trips through parseChipSegments", () => {
    const { text } = serializeDocument(
      doc(
        paragraph(
          chipNode({ prefix: "tool", value: "web-search", label: "Web search", variant: "accent" }),
        ),
      ),
    );

    expect(parseChipSegments(text)).toEqual([
      {
        type: "chip",
        label: "Web search",
        prefix: "tool",
        value: "web-search",
        variant: "accent",
      },
    ]);
  });

  test("non-paragraph blocks and unknown inline nodes are skipped", () => {
    const { text } = serializeDocument(
      doc(
        { type: { name: "heading" }, forEach: () => {} },
        paragraph(textNode("kept"), { type: { name: "hardBreak" }, forEach: () => {} }),
      ),
    );
    expect(text).toBe("kept");
  });
});
