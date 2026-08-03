// Prefix detection — the engine-agnostic kernel of the command system: the
// active-token state shape and the pure scan that derives it from the text
// around the caret. Sticky range tracking and dismissal memory live one layer
// up, in trigger-tracker.ts.

import type { TriggerRule } from "./types";

// ---------------------------------------------------------------------------
// Types & constants
// ---------------------------------------------------------------------------

export type RegisteredPrefix = {
  prefix: string;
  triggerRule: TriggerRule;
};

export type ActiveTokenState = {
  isOpen: boolean;
  trigger: string | null;
  query: string;
  triggerStartPosition: number;
  // End of the active token (after its last character). The token — prefix plus
  // its whole non-whitespace run — is treated as a single unit: badge, delete-on-
  // select range, and arrow-key trapping all span [start, end], independent of
  // where the caret sits inside it.
  triggerEndPosition: number;
  // Start position of a token the user explicitly dismissed (Escape / Dismiss).
  // Suppresses re-opening that same token until its prefix is removed; mapped
  // forward through every doc change so it keeps tracking the right spot.
  dismissedAt: number | null;
};

export const CLOSED_COMMAND_STATE: ActiveTokenState = {
  isOpen: false,
  trigger: null,
  query: "",
  triggerStartPosition: 0,
  triggerEndPosition: 0,
  dismissedAt: null,
};

// ---------------------------------------------------------------------------
// Prefix detection — scan the block around the caret for a registered trigger
// and derive the active-token state (pure; engine integrations call it).
// ---------------------------------------------------------------------------

export const detectActivePrefix = (args: {
  registered: RegisteredPrefix[];
  blockStart: number;
  blockEnd: number;
  cursorPosition: number;
  textBeforeCursor: string;
  textAfterCursor: string;
  fullDocText: string;
}): ActiveTokenState => {
  const {
    registered,
    blockStart,
    blockEnd,
    cursorPosition,
    textBeforeCursor,
    textAfterCursor,
    fullDocText,
  } = args;

  for (const entry of registered) {
    if (entry.triggerRule === "doc-start") {
      if (fullDocText.startsWith(entry.prefix)) {
        return {
          isOpen: true,
          trigger: entry.prefix,
          query: fullDocText.slice(entry.prefix.length),
          triggerStartPosition: blockStart,
          triggerEndPosition: blockEnd,
          dismissedAt: null,
        };
      }
      continue;
    }

    // The token is the contiguous non-whitespace run the caret sits inside,
    // taken from both sides of the caret so it stays whole as the caret moves
    // within it. Text chars map 1:1 to positions and an atomic chip can never
    // sit inside a run, so the run length is the position delta on each side.
    const leftRun = textBeforeCursor.match(/\S*$/)?.[0] ?? "";
    const rightRun = textAfterCursor.match(/^\S*/)?.[0] ?? "";
    const runText = leftRun + rightRun;
    if (!runText.startsWith(entry.prefix)) continue;

    // The prefix must sit at a word boundary: line start or after whitespace.
    const charBeforeRun = textBeforeCursor
      .slice(0, textBeforeCursor.length - leftRun.length)
      .at(-1);
    if (charBeforeRun !== undefined && !/\s/.test(charBeforeRun)) continue;

    return {
      isOpen: true,
      trigger: entry.prefix,
      query: runText.slice(entry.prefix.length),
      triggerStartPosition: cursorPosition - leftRun.length,
      triggerEndPosition: cursorPosition + rightRun.length,
      dismissedAt: null,
    };
  }

  return CLOSED_COMMAND_STATE;
};
