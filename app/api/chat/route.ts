import { google } from "@ai-sdk/google";
import { convertToModelMessages, smoothStream, streamText } from "ai";
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
