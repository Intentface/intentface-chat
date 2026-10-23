import { bindings, type FoundBinding, tree } from "@intentface/ui/generative";
import { type ModelMessage, tool } from "ai";
import { catalog } from "@/lib/ai/generative-catalog";

/** Where a bound node's data came from, as the chat captions it. */
export type RenderUiSource = {
  /** The source as the reader sees it, such as "the documentation index". */
  label: string;
  /** The data tool and the fields picked from it, such as "listDocsPages → title". */
  picks: string;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

// The data tools a binding can point at: the rows each result offers, and how
// the source reads to the user. A result comes back from the history as plain
// JSON, so its rows are checked, not assumed.
const SOURCES: Record<string, { label: string; rows: (output: unknown) => unknown }> = {
  listDocsPages: {
    label: "the documentation index",
    rows: (output) => (isRecord(output) && Array.isArray(output.pages) ? output.pages : undefined),
  },
};

/** A data tool's result earlier in the conversation, by its call id. */
const findResult = (messages: ModelMessage[], ref: string) => {
  for (const message of messages) {
    if (message.role !== "tool") continue;
    for (const part of message.content) {
      if (part.type === "tool-result" && part.toolCallId === ref && part.output.type === "json") {
        return { toolName: part.toolName, value: part.output.value };
      }
    }
  }
  return undefined;
};

const fieldsOf = (binding: FoundBinding) =>
  binding.columns ?? (binding.column ? [binding.column] : []);

/**
 * Looks each binding's rows up among the earlier tool results, and notes where
 * they came from for the chat's caption.
 */
const lookUpIn = (messages: ModelMessage[]) => {
  const sources: Record<string, RenderUiSource> = {};
  const resolve = (binding: FoundBinding) => {
    const result = findResult(messages, binding.$data);
    const source = result && SOURCES[result.toolName];
    if (!result || !source) return undefined;
    const picks = `${result.toolName} → ${fieldsOf(binding).join(", ")}`;
    sources[binding.id] = { label: source.label, picks };
    return source.rows(result.value);
  };
  return { resolve, sources };
};

export const renderUi = tool({
  description:
    'Show part of the answer as UI: a card of key numbers, or a table to compare items. Use it when a table or a few numbers say more than prose. A table of rows a data tool returned must bind its rows to that result\'s ref, such as { "$data": ref, "columns": ["title", "description"] }, never copy them.',
  // Typed as what the model writes, so the chat's tool parts are typed too.
  inputSchema: tree.schema(catalog),
  // What the chat draws: the finished tree and where its bound data came from,
  // or the issues that refused the call.
  execute: async (input, { messages }) => {
    const checked = await tree.validate(input, catalog);
    if (checked.issues) return { issues: checked.issues };
    // Bound data goes in once, here: a ref that names no result the model was
    // given refuses the call.
    const lookup = lookUpIn(messages);
    const resolved = await bindings.resolve(checked.value, catalog, lookup.resolve);
    if (resolved.issues) return { issues: resolved.issues };
    return { tree: resolved.value, sources: lookup.sources };
  },
  // What the model reads: a line about the result, never the tree itself.
  toModelOutput: ({ output }) => ({
    type: "text",
    value: output.issues
      ? `Nothing was shown. Fix these and call renderUi again:\n${tree.formatIssues(output.issues)}`
      : "Shown to the user. Don't repeat what it shows in your reply.",
  }),
});
