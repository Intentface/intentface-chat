import { google } from "@ai-sdk/google";
import {
  convertToModelMessages,
  smoothStream,
  stepCountIs,
  streamText,
  tool,
} from "ai";
import { z } from "zod";
import { DEFAULT_MODEL, isValidModelId } from "@/lib/models";

export async function POST(req: Request) {
  // Extract messages and model from the request body
  // Messages contain the conversation history (user and assistant messages)
  const { messages, model } = await req.json();

  // Validate the model ID, falling back to the default if invalid
  const modelId = isValidModelId(model) ? model : DEFAULT_MODEL;

  const result = streamText({
    model: google(modelId),
    messages: await convertToModelMessages(messages),
    tools: {
      createArtifact: tool({
        description:
          "Create a document artifact displayed in a side panel. Use for long-form content, guides, structured documents, or any content that benefits from a dedicated view.",
        inputSchema: z.object({
          title: z.string().describe("Title of the artifact"),
          content: z.string().describe("Markdown content of the artifact"),
        }),
        execute: async ({ title, content }) => ({ title, content }),
      }),
    },
    stopWhen: stepCountIs(3),
    providerOptions: {
      google: {
        thinkingConfig: {
          thinkingBudget: 8192,
          includeThoughts: true,
        },
      },
    },
    experimental_transform: smoothStream({ chunking: "word", delayInMs: 20 }),
  });

  return result.toUIMessageStreamResponse({
    sendReasoning: true,
  });
}
