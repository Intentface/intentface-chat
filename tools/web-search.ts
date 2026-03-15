import { openai } from "@ai-sdk/openai";
import { generateText, Output, stepCountIs, tool } from "ai";
import { z } from "zod";

export const webSearch = tool({
  description:
    "Search the web for current information. Use when the user asks about recent events, facts, or anything that benefits from up-to-date sources.",
  inputSchema: z.object({
    query: z.string().describe("The search query"),
  }),
  execute: async ({ query }) => {
    const { output } = await generateText({
      model: openai("gpt-5-mini"),
      prompt: query,
      output: Output.array({
        element: z.object({
          claim: z.string().describe("A factual claim from the search results"),
          sources: z
            .array(
              z.object({
                url: z.string().describe("Source URL"),
                title: z
                  .string()
                  .describe("Short source label, e.g. domain name"),
              }),
            )
            .describe("Sources that support this claim"),
        }),
      }),
      tools: {
        web_search: openai.tools.webSearch({ searchContextSize: "low" }),
      },
      stopWhen: stepCountIs(1),
      temperature: 0,
    });

    return output;
  },
});
