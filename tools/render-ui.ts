import { formatIssues, toJSONSchema, validateTree } from "@intentface/chat/generative";
import { jsonSchema, tool } from "ai";
import { catalog } from "@/lib/ai/generative-catalog";

export const renderUi = tool({
  description:
    'Show part of the answer as UI: a card of key numbers, or a table to compare items. Use it when a table or a few numbers say more than prose. To show a data tool\'s rows, bind the table\'s rows to that result\'s ref, such as { "$data": ref, "columns": ["title", "description"] }, instead of copying them.',
  inputSchema: jsonSchema(toJSONSchema(catalog)),
  execute: async (input) => {
    const result = await validateTree(input, catalog);
    return result.issues
      ? {
          ok: false,
          text: `Nothing was shown. Fix these and call renderUi again:\n${formatIssues(result.issues)}`,
        }
      : { ok: true, text: "Shown to the user. Don't repeat what it shows in your reply." };
  },
  // The model reads only the text; the chat keeps `ok` to hide a refused call.
  toModelOutput: ({ output }) => ({ type: "text", value: output.text }),
});
