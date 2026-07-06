// Command list — prefix trigger detection + the ProseMirror plugin that keeps
// the active-token state and paints the trigger badge decoration. The
// decoration carries no styling of its own — it stamps data-command-badge /
// data-command-placeholder attributes and the styled layer targets them
// from CSS.

import { Plugin, PluginKey } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";
import type { TriggerRule } from "./types";

export type RegisteredPrefix = {
  prefix: string;
  triggerRule: TriggerRule;
};

export type CommandListPluginState = {
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

export const CLOSED_COMMAND_STATE: CommandListPluginState = {
  isOpen: false,
  trigger: null,
  query: "",
  triggerStartPosition: 0,
  triggerEndPosition: 0,
  dismissedAt: null,
};

export const detectActivePrefix = (args: {
  registered: RegisteredPrefix[];
  blockStart: number;
  blockEnd: number;
  cursorPosition: number;
  textBeforeCursor: string;
  textAfterCursor: string;
  fullDocText: string;
}): CommandListPluginState => {
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

export const commandListPluginKey = new PluginKey<CommandListPluginState>("commandList");

export type CommandListPluginOptions = {
  getRegisteredPrefixes: () => RegisteredPrefix[];
};

const commandFilterDecorations = (
  state: Parameters<NonNullable<Plugin["props"]["decorations"]>>[0],
) => {
  const pluginState = commandListPluginKey.getState(state);
  if (!pluginState?.isOpen) return DecorationSet.empty;

  // Highlight the whole token, not just up to the caret, so the badge stays put
  // while the caret roams inside it. Styling hooks only — the styled layer
  // targets data-command-badge / data-command-placeholder from CSS.
  const inline = Decoration.inline(
    pluginState.triggerStartPosition,
    pluginState.triggerEndPosition,
    {
      "data-command-badge": "",
      ...(pluginState.query ? {} : { "data-command-placeholder": "" }),
    },
  );
  return DecorationSet.create(state.doc, [inline]);
};

export const createCommandListPlugin = (options: CommandListPluginOptions) =>
  new Plugin<CommandListPluginState>({
    key: commandListPluginKey,
    state: {
      init: () => CLOSED_COMMAND_STATE,
      apply(transaction, previousState, _oldEditorState, newEditorState) {
        const meta = transaction.getMeta(commandListPluginKey);
        // Escape / Dismiss: close and remember the token's start so re-entering
        // it won't reopen the popup (only present when something was open).
        if (meta?.close) {
          return {
            ...CLOSED_COMMAND_STATE,
            dismissedAt: previousState.isOpen ? previousState.triggerStartPosition : null,
          };
        }

        const registered = options.getRegisteredPrefixes();
        if (registered.length === 0) return CLOSED_COMMAND_STATE;

        // Track the dismissed marker across edits; drop it once its prefix is
        // gone so retyping the trigger starts a fresh attempt.
        let dismissedAt = previousState.dismissedAt;
        if (dismissedAt !== null && transaction.docChanged) {
          const mapped = transaction.mapping.mapResult(dismissedAt, -1);
          dismissedAt = mapped.deleted ? null : mapped.pos;
          if (dismissedAt !== null) {
            const markerPos = dismissedAt;
            const docEnd = newEditorState.doc.content.size;
            const stillPrefixed = registered.some(
              (entry) =>
                markerPos + entry.prefix.length <= docEnd &&
                newEditorState.doc.textBetween(markerPos, markerPos + entry.prefix.length) ===
                  entry.prefix,
            );
            if (!stillPrefixed) dismissedAt = null;
          }
        }

        if (!transaction.docChanged && !transaction.selectionSet) {
          return previousState.dismissedAt === dismissedAt
            ? previousState
            : { ...previousState, dismissedAt };
        }

        // Already-open token: track its range stickily through the change rather
        // than re-scanning (a scan stops at whitespace and would drop typed
        // spaces). The end grows on insert (+1 bias) and shrinks on delete; the
        // query is read from the fixed range, so the filter holds steady — and
        // accepts spaces — as the caret moves inside the token.
        if (previousState.isOpen && previousState.trigger !== null) {
          const trigger = previousState.trigger;
          let start = previousState.triggerStartPosition;
          let end = previousState.triggerEndPosition;
          if (transaction.docChanged) {
            start = transaction.mapping.map(start, -1);
            end = transaction.mapping.map(end, 1);
          }
          const docEnd = newEditorState.doc.content.size;
          const cursor = newEditorState.selection.$from.pos;
          const prefixIntact =
            start + trigger.length <= docEnd &&
            newEditorState.doc.textBetween(start, start + trigger.length) === trigger;
          // Stay open while the prefix survives and the caret is still inside.
          if (prefixIntact && end >= start + trigger.length && cursor >= start && cursor <= end) {
            return {
              isOpen: true,
              trigger,
              query: newEditorState.doc.textBetween(start + trigger.length, end, "\n"),
              triggerStartPosition: start,
              triggerEndPosition: end,
              dismissedAt,
            };
          }
          // Prefix deleted or caret left the token → fall through to a fresh
          // scan (or closed) below.
        }

        const { selection } = newEditorState;
        const cursorPosition = selection.$from.pos;
        const blockStart = selection.$from.start();
        const blockEnd = selection.$from.end();
        const textBeforeCursor = newEditorState.doc.textBetween(blockStart, cursorPosition, "\n");
        const textAfterCursor = newEditorState.doc.textBetween(cursorPosition, blockEnd, "\n");
        const fullDocText = newEditorState.doc.textContent;

        const detected = detectActivePrefix({
          registered,
          blockStart,
          blockEnd,
          cursorPosition,
          textBeforeCursor,
          textAfterCursor,
          fullDocText,
        });

        if (detected.isOpen) {
          // Same token the user dismissed → stay closed. A different token →
          // open and forget the prior dismissal.
          if (dismissedAt !== null && detected.triggerStartPosition === dismissedAt) {
            return { ...CLOSED_COMMAND_STATE, dismissedAt };
          }
          return { ...detected, dismissedAt: null };
        }

        return { ...CLOSED_COMMAND_STATE, dismissedAt };
      },
    },
    props: { decorations: (state) => commandFilterDecorations(state) },
  });
