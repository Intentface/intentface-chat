import { describe, expect, test } from "bun:test";
import {
  CLOSED_COMMAND_STATE,
  type CommandListPluginState,
  type RegisteredPrefix,
} from "../src/composer/prefix-detection";
import { closeActiveToken, trackActiveToken } from "../src/composer/trigger-tracker";

// The tracker is driven like the engine drives it: a scan-text snapshot after
// each edit plus the TextChange that produced it (null for caret-only moves).
// These tests port the PM plugin's sticky-token behaviors onto the flat model.

const AT: RegisteredPrefix[] = [{ prefix: "@", triggerRule: "after-whitespace" }];
const SLASH: RegisteredPrefix[] = [{ prefix: "/", triggerRule: "doc-start" }];

const typeAt = (
  previous: CommandListPluginState,
  scanText: string,
  caret: number,
  change: { rangeStart: number; rangeEnd: number; insertedLength: number } | null,
  registered: RegisteredPrefix[] = AT,
) => trackActiveToken(previous, { registered, scanText, caret, change });

describe("fresh detection", () => {
  test("typing a trigger at a word boundary opens", () => {
    const state = typeAt(CLOSED_COMMAND_STATE, "hi @", 4, {
      rangeStart: 3,
      rangeEnd: 3,
      insertedLength: 1,
    });
    expect(state.isOpen).toBe(true);
    expect(state.trigger).toBe("@");
    expect(state.query).toBe("");
    expect(state.triggerStartPosition).toBe(3);
    expect(state.triggerEndPosition).toBe(4);
  });

  test("a trigger mid-word does not open", () => {
    const state = typeAt(CLOSED_COMMAND_STATE, "hi@", 3, {
      rangeStart: 2,
      rangeEnd: 2,
      insertedLength: 1,
    });
    expect(state.isOpen).toBe(false);
  });

  test("doc-start rule opens only from the document start", () => {
    const state = typeAt(CLOSED_COMMAND_STATE, "/he", 3, null, SLASH);
    expect(state.isOpen).toBe(true);
    expect(state.query).toBe("he");
  });
});

describe("sticky open token", () => {
  const open = typeAt(CLOSED_COMMAND_STATE, "hi @", 4, {
    rangeStart: 3,
    rangeEnd: 3,
    insertedLength: 1,
  });

  test("the end grows as the user types — including spaces in the query", () => {
    let state = typeAt(open, "hi @ra", 6, { rangeStart: 4, rangeEnd: 4, insertedLength: 2 });
    expect(state.query).toBe("ra");
    // A typed space would end a fresh scan's token; the sticky range keeps it.
    state = typeAt(state, "hi @ra x", 8, { rangeStart: 6, rangeEnd: 6, insertedLength: 2 });
    expect(state.isOpen).toBe(true);
    expect(state.query).toBe("ra x");
    expect(state.triggerEndPosition).toBe(8);
  });

  test("an edit before the token shifts the whole range", () => {
    const state = typeAt(open, "hey hi @", 8, { rangeStart: 0, rangeEnd: 0, insertedLength: 4 });
    expect(state.isOpen).toBe(true);
    expect(state.triggerStartPosition).toBe(7);
    expect(state.triggerEndPosition).toBe(8);
  });

  test("deleting the prefix closes", () => {
    const state = typeAt(open, "hi ", 3, { rangeStart: 3, rangeEnd: 4, insertedLength: 0 });
    expect(state.isOpen).toBe(false);
  });

  test("caret leaving the token closes (selection-only update)", () => {
    const state = typeAt(open, "hi @", 0, null);
    expect(state.isOpen).toBe(false);
  });

  test("caret moving within the token stays open (selection-only update)", () => {
    const grown = typeAt(open, "hi @ra", 6, { rangeStart: 4, rangeEnd: 4, insertedLength: 2 });
    const state = typeAt(grown, "hi @ra", 5, null);
    expect(state.isOpen).toBe(true);
    expect(state.query).toBe("ra");
  });
});

describe("dismissal memory", () => {
  const open = typeAt(CLOSED_COMMAND_STATE, "hi @", 4, {
    rangeStart: 3,
    rangeEnd: 3,
    insertedLength: 1,
  });

  test("closeActiveToken records the dismissed token start", () => {
    expect(closeActiveToken(open).dismissedAt).toBe(3);
    expect(closeActiveToken(CLOSED_COMMAND_STATE).dismissedAt).toBeNull();
  });

  test("the dismissed token does not reopen while its prefix survives", () => {
    const dismissed = closeActiveToken(open);
    // Type inside the dismissed token — caret re-enters it, scan re-detects it.
    const state = typeAt(dismissed, "hi @r", 5, { rangeStart: 4, rangeEnd: 4, insertedLength: 1 });
    expect(state.isOpen).toBe(false);
    expect(state.dismissedAt).toBe(3);
  });

  test("the marker shifts with edits before it", () => {
    const dismissed = closeActiveToken(open);
    const state = typeAt(dismissed, "X hi @", 0, { rangeStart: 0, rangeEnd: 0, insertedLength: 2 });
    expect(state.dismissedAt).toBe(5);
  });

  test("removing the prefix clears the marker so retyping starts fresh", () => {
    const dismissed = closeActiveToken(open);
    const cleared = typeAt(dismissed, "hi ", 3, { rangeStart: 3, rangeEnd: 4, insertedLength: 0 });
    expect(cleared.dismissedAt).toBeNull();
    const reopened = typeAt(cleared, "hi @", 4, { rangeStart: 3, rangeEnd: 3, insertedLength: 1 });
    expect(reopened.isOpen).toBe(true);
  });

  test("a different token opens and forgets the prior dismissal", () => {
    const dismissed = closeActiveToken(open);
    // A second trigger typed later in the doc.
    const state = typeAt(dismissed, "hi @ and @", 10, {
      rangeStart: 4,
      rangeEnd: 4,
      insertedLength: 6,
    });
    expect(state.isOpen).toBe(true);
    expect(state.triggerStartPosition).toBe(9);
    expect(state.dismissedAt).toBeNull();
  });
});

describe("chips in scan text", () => {
  test("a chip (as space) breaks the token run", () => {
    // "hi @x b" where position 4 is a chip → scan "hi @ b": the run around
    // the caret at 6 does not start with "@".
    const state = typeAt(CLOSED_COMMAND_STATE, "hi @ b", 6, null);
    expect(state.isOpen).toBe(false);
  });

  test("a chip before the trigger still counts as a word boundary", () => {
    // Chip at position 0 reads as " " → "@ " at 1 sits after whitespace.
    const state = typeAt(CLOSED_COMMAND_STATE, " @", 2, {
      rangeStart: 1,
      rangeEnd: 1,
      insertedLength: 1,
    });
    expect(state.isOpen).toBe(true);
    expect(state.triggerStartPosition).toBe(1);
  });
});

describe("line breaks", () => {
  const open = typeAt(CLOSED_COMMAND_STATE, "hi @", 4, {
    rangeStart: 3,
    rangeEnd: 3,
    insertedLength: 1,
  });

  test("a newline entering the token range closes it instead of being absorbed", () => {
    const state = typeAt(open, "hi @\n", 5, { rangeStart: 4, rangeEnd: 4, insertedLength: 1 });
    expect(state.isOpen).toBe(false);
  });

  test("a pasted newline inside a grown token also closes it", () => {
    const grown = typeAt(open, "hi @ra", 6, { rangeStart: 4, rangeEnd: 4, insertedLength: 2 });
    const state = typeAt(grown, "hi @r\na", 7, { rangeStart: 5, rangeEnd: 5, insertedLength: 1 });
    expect(state.isOpen).toBe(false);
  });
});
