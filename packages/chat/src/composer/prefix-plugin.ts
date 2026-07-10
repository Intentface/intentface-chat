// Command list plugin — the ProseMirror integration over the pure prefix
// detection: sticky active-token state and the trigger badge decoration. The
// decoration carries no styling of its own — it stamps data-command-badge /
// data-command-placeholder attributes and the styled layer targets them
// from CSS.

import { Plugin, PluginKey } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";
import {
  CLOSED_COMMAND_STATE,
  type CommandListPluginState,
  detectActivePrefix,
  type RegisteredPrefix,
} from "./prefix-detection";

// ---------------------------------------------------------------------------
// ProseMirror plugin — owns the active-token state (sticky range tracking,
// dismissal memory) and paints the trigger badge decoration.
// ---------------------------------------------------------------------------

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
