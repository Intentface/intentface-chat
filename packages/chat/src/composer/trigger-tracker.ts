// Trigger tracker — the engine-side port of the ProseMirror command-list
// plugin's apply(): sticky active-token state over the flat position model.
// Pure: consumes the scan text (chips read as " ", so a token can never span
// a chip and positions stay 1:1) plus an optional TextChange, and produces the
// same CommandListPluginState shape the store mirrors and the command list
// consumes.
//
// Divergences from the PM plugin, both unobservable in practice: chips
// contribute " " to scan text where PM's textBetween contributed "" (keeps
// position math exact), and doc-start queries read through that space.

import {
  CLOSED_COMMAND_STATE,
  type CommandListPluginState,
  detectActivePrefix,
  type RegisteredPrefix,
} from "./prefix-detection";
import { lineBoundsAt, mapPosition, mapPositionResult, type TextChange } from "./segments";

export type TrackerUpdate = {
  registered: RegisteredPrefix[];
  /** toScanText(doc) — chips as " ". */
  scanText: string;
  caret: number;
  /** The doc edit, or null for a selection-only update. */
  change: TextChange | null;
};

// Escape / Dismiss / blur-close: close and remember the token's start so
// re-entering it won't reopen the popup (only when something was open).
export const closeActiveToken = (previous: CommandListPluginState): CommandListPluginState => ({
  ...CLOSED_COMMAND_STATE,
  dismissedAt: previous.isOpen ? previous.triggerStartPosition : null,
});

export const trackActiveToken = (
  previous: CommandListPluginState,
  update: TrackerUpdate,
): CommandListPluginState => {
  const { registered, scanText, caret, change } = update;

  if (registered.length === 0) return CLOSED_COMMAND_STATE;

  // Track the dismissed marker across edits; drop it once its prefix is gone
  // so retyping the trigger starts a fresh attempt.
  let dismissedAt = previous.dismissedAt;
  if (dismissedAt !== null && change !== null) {
    const mapped = mapPositionResult(dismissedAt, change, -1);
    dismissedAt = mapped.deleted ? null : mapped.position;
    if (dismissedAt !== null) {
      const markerPosition = dismissedAt;
      const stillPrefixed = registered.some(
        (entry) =>
          markerPosition + entry.prefix.length <= scanText.length &&
          scanText.slice(markerPosition, markerPosition + entry.prefix.length) === entry.prefix,
      );
      if (!stillPrefixed) dismissedAt = null;
    }
  }

  // Already-open token: track its range stickily through the change rather
  // than re-scanning (a scan stops at whitespace and would drop typed
  // spaces). The end grows on insert (+1 bias) and shrinks on delete; the
  // query is read from the fixed range, so the filter holds steady — and
  // accepts spaces — as the caret moves inside the token.
  if (previous.isOpen && previous.trigger !== null) {
    const trigger = previous.trigger;
    let start = previous.triggerStartPosition;
    let end = previous.triggerEndPosition;
    if (change !== null) {
      start = mapPosition(start, change, -1);
      end = mapPosition(end, change, 1);
    }
    const prefixIntact =
      start + trigger.length <= scanText.length &&
      scanText.slice(start, start + trigger.length) === trigger;
    const tokenText = scanText.slice(start, end);
    // Stay open while the prefix survives and the caret is still inside — but
    // a token can never span a line break: the sticky end would otherwise
    // absorb an inserted "\n" (soft break, pasted newline) and drag the badge
    // across lines.
    if (
      prefixIntact &&
      end >= start + trigger.length &&
      caret >= start &&
      caret <= end &&
      !tokenText.includes("\n")
    ) {
      return {
        isOpen: true,
        trigger,
        query: tokenText.slice(trigger.length),
        triggerStartPosition: start,
        triggerEndPosition: end,
        dismissedAt,
      };
    }
    // Prefix deleted or caret left the token → fall through to a fresh scan.
  }

  const { lineStart, lineEnd } = lineBoundsAt(scanText, caret);
  const detected = detectActivePrefix({
    registered,
    blockStart: lineStart,
    blockEnd: lineEnd,
    cursorPosition: caret,
    textBeforeCursor: scanText.slice(lineStart, caret),
    textAfterCursor: scanText.slice(caret, lineEnd),
    fullDocText: scanText,
  });

  if (detected.isOpen) {
    // Same token the user dismissed → stay closed. A different token → open
    // and forget the prior dismissal.
    if (dismissedAt !== null && detected.triggerStartPosition === dismissedAt) {
      return { ...CLOSED_COMMAND_STATE, dismissedAt };
    }
    return { ...detected, dismissedAt: null };
  }

  return { ...CLOSED_COMMAND_STATE, dismissedAt };
};
