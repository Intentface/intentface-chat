import type { createOpenAI } from "@ai-sdk/openai";
import { generateText, Output, stepCountIs, tool } from "ai";
import { z } from "zod";

// Takes the provider rather than importing the default one: the default reads
// process.env.OPENAI_API_KEY, which no longer exists — the playground runs on the
// visitor's key, so the tool has to use the same per-request provider the route
// builds from their cookie.
export const createWebSearch = (openai: ReturnType<typeof createOpenAI>) =>
  tool({
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
                  title: z.string().describe("Short source label, e.g. domain name"),
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
