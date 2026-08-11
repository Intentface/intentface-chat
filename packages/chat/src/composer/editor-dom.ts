// Editor DOM — the adapters between the contenteditable element and the flat
// segment model. The reader and position mapping are pure (they walk a
// minimal structural node view, so tests need no DOM); the materializers at
// the bottom are thin real-DOM wrappers over the pure spec builder.
//
// Writer/reader pact for line breaks: every "\n" renders as <br>, plus one
// padding <br> when the document is empty or ends with "\n" (an unpadded
// trailing line is unreachable/zero-height). The padding carries
// data-padding-break, so the reader identifies it structurally rather than
// inferring it from position — a native edit that strands it mid-document then
// reads as scaffolding (dropped, dirty) instead of a phantom newline. Unmarked
// trailing <br>s are the browser's own (Chrome keeps an emptied line box
// alive); those still fall back to dropping one trailing "\n".
// Round-trips: "" ↔ <br·pad>, "a\n" ↔ a<br><br·pad>, "a\n\n" ↔ a<br><br><br·pad>.

import type { ChipData } from "../chip-markdown";
import { nextChipId, type SegmentDoc } from "./segments";

// ---------------------------------------------------------------------------
// Structural node view — the SerializableNode precedent: the pure functions
// only touch these members, so tests drive them with plain objects.
// ---------------------------------------------------------------------------

export type ReadableNode = {
  nodeType: number;
  nodeName: string;
  /** Text node content (nodeType 3). */
  data?: string;
  childNodes: ArrayLike<ReadableNode>;
  getAttribute?: (name: string) => string | null;
};

const TEXT_NODE = 3;
const ELEMENT_NODE = 1;

// Elements whose appearance inside the editable means something rewrote our
// flat structure (paste leftovers, extensions) — content still reads, but the
// document gets renormalized from the model afterwards.
const BLOCK_NODE_NAMES = new Set([
  "DIV",
  "P",
  "PRE",
  "BLOCKQUOTE",
  "UL",
  "OL",
  "LI",
  "H1",
  "H2",
  "H3",
  "H4",
  "H5",
  "H6",
  "TABLE",
]);

export const toReadable = (node: Node): ReadableNode => node as unknown as ReadableNode;

const chipIdOf = (node: ReadableNode): string | null =>
  node.nodeType === ELEMENT_NODE ? (node.getAttribute?.("data-chip-id") ?? null) : null;

// Non-editable elements without a chip identity are pure presentation (the
// badge's hint span) — invisible to the model: the reader skips them and the
// position mappers give them zero width.
const isPresentationOnly = (node: ReadableNode): boolean =>
  node.nodeType === ELEMENT_NODE &&
  node.getAttribute?.("contenteditable") === "false" &&
  chipIdOf(node) === null;

// The writer marks its padding <br> so the reader can recognize it structurally
// instead of inferring it from position. Zero width everywhere: it is scaffolding
// for the last line box, never content.
export const PADDING_BREAK_ATTRIBUTE = "data-padding-break";

const isPaddingBreak = (node: ReadableNode): boolean =>
  node.nodeType === ELEMENT_NODE &&
  node.nodeName === "BR" &&
  (node.getAttribute?.(PADDING_BREAK_ATTRIBUTE) ?? null) !== null;

// ---------------------------------------------------------------------------
// Reader — DOM → segments. Adjacent text concatenates (fragmentation is
// normalized logically, never via root.normalize() — WebKit collapses the
// caret when the selection's text node gets merged), NBSP reads as a plain
// space, badge spans and unknown inline elements are transparent wrappers,
// chip spans resolve through the registry.
// ---------------------------------------------------------------------------

export const readDocumentFromDom = (
  root: ReadableNode,
  resolveChip: (id: string) => ChipData | null,
  makeId: () => string = nextChipId,
): { doc: SegmentDoc; dirty: boolean } => {
  const doc: SegmentDoc = [];
  let dirty = false;
  let pendingText = "";
  let lastWasBreak = false;
  // A marked padding <br> is legal only at the very end. Content visited after
  // one means a native edit stranded it mid-document — drop it and repaint.
  let sawPaddingBreak = false;
  const seenChipIds = new Set<string>();

  const notePaddingStranded = () => {
    if (!sawPaddingBreak) return;
    dirty = true;
    sawPaddingBreak = false;
  };

  const flushText = () => {
    if (pendingText.length === 0) return;
    const previous = doc.at(-1);
    if (previous?.type === "text") {
      doc[doc.length - 1] = { type: "text", text: previous.text + pendingText };
    } else {
      doc.push({ type: "text", text: pendingText });
    }
    pendingText = "";
  };

  const visit = (node: ReadableNode) => {
    if (node.nodeType === TEXT_NODE) {
      const content = (node.data ?? "").replace(/\u00A0/g, " ");
      if (content.length > 0) {
        notePaddingStranded();
        pendingText += content;
        lastWasBreak = false;
      }
      return;
    }
    if (node.nodeType !== ELEMENT_NODE) return;

    if (node.nodeName === "BR") {
      notePaddingStranded();
      // Marked padding never contributes a "\n", and it clears the trailing
      // inversion below — that fallback exists for browser-created <br>s only.
      if (isPaddingBreak(node)) {
        sawPaddingBreak = true;
        lastWasBreak = false;
        return;
      }
      pendingText += "\n";
      lastWasBreak = true;
      return;
    }

    const chipId = chipIdOf(node);
    if (chipId !== null) {
      // Chip span content is presentation — never read. Unknown ids are
      // leftovers from DOM the model doesn't know (mark dirty, skip);
      // duplicated ids (clone paths) get a fresh identity.
      notePaddingStranded();
      const chip = resolveChip(chipId);
      if (!chip) {
        dirty = true;
        return;
      }
      flushText();
      const id = seenChipIds.has(chipId) ? makeId() : chipId;
      seenChipIds.add(chipId);
      doc.push({ type: "chip", id, chip });
      lastWasBreak = false;
      return;
    }

    // Presentation-only elements (the badge's hint span) never reach the model.
    if (isPresentationOnly(node)) return;

    // Badge span / unknown inline: transparent wrapper. Block elements also
    // read through, but flag the document for renormalization.
    if (BLOCK_NODE_NAMES.has(node.nodeName)) dirty = true;
    for (const child of Array.from(node.childNodes)) visit(child);
  };

  for (const child of Array.from(root.childNodes)) visit(child);

  // Fallback for unmarked trailing <br>s (browser-created line-box keepers):
  // treat one trailing "\n" as padding. Our own padding is marked and already
  // dropped above, so this never double-fires.
  if (lastWasBreak && pendingText.endsWith("\n")) {
    pendingText = pendingText.slice(0, -1);
  }
  flushText();

  return { doc, dirty };
};

// ---------------------------------------------------------------------------
// Position mapping — DOM points ↔ logical positions. Chips count 1, <br>
// counts 1 (it renders a "\n") unless it is the marked padding, badge/unknown
// wrappers are transparent.
// ---------------------------------------------------------------------------

/** Logical position of (node, offset), or null when the point isn't inside root. */
export const logicalRangeFromDom = (
  root: ReadableNode,
  targetNode: ReadableNode,
  targetOffset: number,
): number | null => {
  let position = 0;
  let found: number | null = null;

  const visit = (node: ReadableNode): boolean => {
    if (node === targetNode && node.nodeType !== TEXT_NODE && chipIdOf(node) === null) {
      // Element point: offset is a child index — resolve by walking children
      // until the index, then record.
      const children = Array.from(node.childNodes).slice(0, targetOffset);
      for (const child of children) {
        if (measure(child)) return true;
      }
      found = position;
      return true;
    }

    if (node.nodeType === TEXT_NODE) {
      if (node === targetNode) {
        found = position + Math.min(targetOffset, (node.data ?? "").length);
        return true;
      }
      position += (node.data ?? "").length;
      return false;
    }
    if (node.nodeType !== ELEMENT_NODE) return false;

    if (node.nodeName === "BR") {
      // Padding is zero-width, so the DOM's position space matches the model's
      // flat-text length instead of running one past it.
      if (!isPaddingBreak(node)) position += 1;
      return false;
    }

    if (chipIdOf(node) !== null) {
      // A point inside a chip clamps to the chip's start.
      if (node === targetNode || contains(node, targetNode)) {
        found = position;
        return true;
      }
      position += 1;
      return false;
    }

    // Presentation-only elements are zero-width; a point inside one clamps to
    // its boundary.
    if (isPresentationOnly(node)) {
      if (node === targetNode || contains(node, targetNode)) {
        found = position;
        return true;
      }
      return false;
    }

    for (const child of Array.from(node.childNodes)) {
      if (visit(child)) return true;
    }
    return false;
  };

  // Advance `position` past a whole subtree (used for element-point offsets).
  const measure = (node: ReadableNode): boolean => visit(node);

  const contains = (parent: ReadableNode, target: ReadableNode): boolean => {
    for (const child of Array.from(parent.childNodes)) {
      if (child === target || contains(child, target)) return true;
    }
    return false;
  };

  if (root === targetNode) {
    const children = Array.from(root.childNodes).slice(0, targetOffset);
    for (const child of children) {
      if (measure(child)) return found;
    }
    return position;
  }

  for (const child of Array.from(root.childNodes)) {
    if (visit(child)) return found;
  }
  return found;
};

// ---------------------------------------------------------------------------
// Spec builder — segments → the canonical child list. Pure and fully tested;
// the materializer below just instantiates it.
// ---------------------------------------------------------------------------

export type DomNodeSpec =
  | { kind: "text"; text: string }
  | { kind: "br"; padding: boolean }
  | { kind: "chip"; id: string };

export const documentToDomSpec = (doc: SegmentDoc): DomNodeSpec[] => {
  const specs: DomNodeSpec[] = [];

  for (const segment of doc) {
    if (segment.type === "chip") {
      specs.push({ kind: "chip", id: segment.id });
      continue;
    }
    const lines = segment.text.split("\n");
    lines.forEach((line, lineIndex) => {
      if (lineIndex > 0) specs.push({ kind: "br", padding: false });
      if (line.length > 0) specs.push({ kind: "text", text: line });
    });
  }

  // Padding <br>: an empty document or one ending in a line break needs a
  // trailing <br> for the last line to be reachable and have height.
  const last = specs.at(-1);
  if (!last || last.kind === "br") specs.push({ kind: "br", padding: true });

  return specs;
};

// ---------------------------------------------------------------------------
// Real-DOM materializers — thin, untested by design; all decisions live in
// the pure layers above.
// ---------------------------------------------------------------------------

const createChipSpan = (id: string): HTMLElement => {
  const span = document.createElement("span");
  span.contentEditable = "false";
  span.setAttribute("data-mention-chip", "");
  span.setAttribute("data-chip-id", id);
  // A chip is atomic inline content: it must sit on the text baseline and must
  // not inherit the editor's break-spaces whitespace mode, or its label wraps
  // mid-chip.
  span.style.display = "inline";
  span.style.verticalAlign = "baseline";
  span.style.whiteSpace = "normal";
  return span;
};

/**
 * Render the canonical child list. Existing chip spans are reused by id —
 * moving a node preserves its React portal; recreating it would remount the
 * chip content. Returns the live id → element map for the portal layer.
 */
export const renderDocumentToDom = (
  root: HTMLElement,
  doc: SegmentDoc,
): Map<string, HTMLElement> => {
  const existingSpans = new Map<string, HTMLElement>();
  for (const span of root.querySelectorAll<HTMLElement>("[data-chip-id]")) {
    const id = span.getAttribute("data-chip-id");
    if (id && !existingSpans.has(id)) existingSpans.set(id, span);
  }

  const chipsById = new Map(
    doc.flatMap((segment) =>
      segment.type === "chip" ? [[segment.id, segment.chip] as const] : [],
    ),
  );

  const chipElements = new Map<string, HTMLElement>();
  const children = documentToDomSpec(doc).map((spec): Node => {
    if (spec.kind === "text") return document.createTextNode(spec.text);
    if (spec.kind === "br") {
      const br = document.createElement("br");
      if (spec.padding) br.setAttribute(PADDING_BREAK_ATTRIBUTE, "");
      return br;
    }
    const span = existingSpans.get(spec.id) ?? createChipSpan(spec.id);
    // Without an accessible boundary the chip reads as bare prose inside the
    // textbox — label + type gives AT an atomic token ("Rasmus, @ mention").
    const chip = chipsById.get(spec.id);
    if (chip) span.setAttribute("aria-label", `${chip.label}, ${chip.prefix} mention`);
    chipElements.set(spec.id, span);
    return span;
  });

  root.replaceChildren(...children);
  return chipElements;
};

/** DOM point for a logical position, preferring text-node points. */
export const domPointFromLogical = (
  root: HTMLElement,
  position: number,
): { node: Node; offset: number } => {
  let remaining = position;

  const walk = (parent: Node): { node: Node; offset: number } | null => {
    for (let index = 0; index < parent.childNodes.length; index++) {
      const child = parent.childNodes[index];
      if (!child) continue;

      if (child.nodeType === TEXT_NODE) {
        const length = (child as Text).data.length;
        if (remaining <= length) return { node: child, offset: remaining };
        remaining -= length;
        continue;
      }
      if (child.nodeType !== ELEMENT_NODE) continue;

      const element = child as HTMLElement;
      if (element.nodeName === "BR" || element.hasAttribute("data-chip-id")) {
        if (remaining === 0) return { node: parent, offset: index };
        // Mirrors logicalRangeFromDom: the padding <br> consumes no position,
        // so the caret can never be written past the end of the model.
        if (!isPaddingBreak(toReadable(element))) remaining -= 1;
        continue;
      }
      // Presentation-only (the badge's hint span): zero width, never a target.
      if (isPresentationOnly(toReadable(element))) continue;
      // Transparent wrapper (badge span): descend.
      const inner = walk(element);
      if (inner) return inner;
    }
    return remaining === 0 ? { node: parent, offset: parent.childNodes.length } : null;
  };

  return walk(root) ?? { node: root, offset: root.childNodes.length };
};

export const readSelectionRange = (root: HTMLElement): { start: number; end: number } | null => {
  const selection = root.ownerDocument.getSelection();
  if (!selection || selection.rangeCount === 0) return null;
  const range = selection.getRangeAt(0);
  if (!root.contains(range.startContainer) || !root.contains(range.endContainer)) return null;
  const start = logicalRangeFromDom(
    toReadable(root),
    toReadable(range.startContainer),
    range.startOffset,
  );
  const end = logicalRangeFromDom(
    toReadable(root),
    toReadable(range.endContainer),
    range.endOffset,
  );
  if (start === null || end === null) return null;
  return start <= end ? { start, end } : { start: end, end: start };
};

export const writeCaretToDom = (root: HTMLElement, start: number, end: number = start): void => {
  const selection = root.ownerDocument.getSelection();
  if (!selection) return;
  const anchor = domPointFromLogical(root, start);
  const focus = end === start ? anchor : domPointFromLogical(root, end);
  selection.setBaseAndExtent(anchor.node, anchor.offset, focus.node, focus.offset);
};

// ---------------------------------------------------------------------------
// Badge maintenance — wrap the active trigger token in a real inline span so
// the styled layer and the popover anchor keep working. Idempotent: the fast
// path (existing span already covers exactly the token) runs on every
// selectionchange and must not touch the DOM.
// ---------------------------------------------------------------------------

export type BadgeToken = { start: number; end: number; showPlaceholder: boolean };

const badgeSpansOf = (root: HTMLElement): HTMLElement[] => [
  ...root.querySelectorAll<HTMLElement>("[data-command-badge]"),
];

const unwrapBadgeSpan = (span: HTMLElement): void => {
  const parent = span.parentNode;
  if (!parent) return;
  // Presentation children (the hint span) are the badge's own chrome — they
  // die with it rather than spilling into content.
  for (const child of [...span.children]) {
    if (isPresentationOnly(toReadable(child))) child.remove();
  }
  while (span.firstChild) parent.insertBefore(span.firstChild, span);
  parent.removeChild(span);
  // No parent.normalize() — the reader concatenates fragmented text nodes,
  // and merging the selection's node collapses the caret in WebKit.
};

// The badge's logical text length: direct text nodes only — the hint span is
// zero-width presentation and must not count toward the token range.
const badgeTextLength = (span: HTMLElement): number => {
  let length = 0;
  for (const child of [...span.childNodes]) {
    if (child.nodeType === TEXT_NODE) length += (child as Text).data.length;
  }
  return length;
};

/**
 * Make the DOM match the token (or its absence). Returns true when the DOM
 * changed — the caller must restore the caret afterwards.
 */
export const syncBadge = (root: HTMLElement, token: BadgeToken | null): boolean => {
  const spans = badgeSpansOf(root);

  if (!token) {
    if (spans.length === 0) return false;
    for (const span of spans) unwrapBadgeSpan(span);
    return true;
  }

  // Fast path: one span already covering exactly [start, end] with the right
  // placeholder marker.
  const [onlySpan] = spans;
  if (spans.length === 1 && onlySpan) {
    const span = onlySpan;
    const parent = span.parentNode;
    if (parent) {
      const index = [...parent.childNodes].indexOf(span);
      const spanStart = logicalRangeFromDom(toReadable(root), toReadable(parent), index);
      const spanLength = badgeTextLength(span);
      const hasPlaceholder = span.hasAttribute("data-command-placeholder");
      if (
        spanStart === token.start &&
        spanStart + spanLength === token.end &&
        hasPlaceholder === token.showPlaceholder
      ) {
        return false;
      }
    }
  }

  for (const span of spans) unwrapBadgeSpan(span);

  // Wrap [start, end]: a Range handles boundary text-node splitting for us.
  // The token is text-only by construction (chips scan as whitespace), so the
  // extracted fragment never partially covers a non-text node.
  const startPoint = domPointFromLogical(root, token.start);
  const endPoint = domPointFromLogical(root, token.end);
  const range = root.ownerDocument.createRange();
  range.setStart(startPoint.node, startPoint.offset);
  range.setEnd(endPoint.node, endPoint.offset);

  const span = root.ownerDocument.createElement("span");
  span.setAttribute("data-command-badge", "");
  if (token.showPlaceholder) span.setAttribute("data-command-placeholder", "");
  span.appendChild(range.extractContents());
  range.insertNode(span);

  return true;
};

// ---------------------------------------------------------------------------
// Caret visibility — native typing auto-scrolls; programmatic writes don't.
// Nudge only the nearest scrollable ancestor (never scrollIntoView — it
// yanks the whole page).
// ---------------------------------------------------------------------------

export const scrollCaretIntoView = (root: HTMLElement): void => {
  const selection = root.ownerDocument.getSelection();
  if (!selection || selection.rangeCount === 0) return;
  const rect = selection.getRangeAt(0).getBoundingClientRect();

  let scroller: HTMLElement | null = root;
  while (scroller && scroller !== root.ownerDocument.body) {
    const { overflowY } = getComputedStyle(scroller);
    if (
      (overflowY === "auto" || overflowY === "scroll") &&
      scroller.scrollHeight > scroller.clientHeight
    ) {
      break;
    }
    scroller = scroller.parentElement;
  }
  if (!scroller || scroller === root.ownerDocument.body) return;

  const view = scroller.getBoundingClientRect();
  if (rect.top < view.top) scroller.scrollTop -= view.top - rect.top;
  else if (rect.bottom > view.bottom) scroller.scrollTop += rect.bottom - view.bottom;
};
