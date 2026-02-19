import { google } from "@ai-sdk/google";
import { createOpenAI } from "@ai-sdk/openai";
import {
  convertToModelMessages,
  smoothStream,
  stepCountIs,
  streamText,
} from "ai";
import { DEFAULT_MODEL, getModelConfig, isValidModelId } from "@/lib/models";
import { createArtifact } from "@/tools/create-artifact";

const balsam = createOpenAI({
  baseURL: "http://localhost:8800/v1",
  apiKey: "anything",
});

export async function POST(req: Request) {
  const { messages, model } = await req.json();

  const modelId = isValidModelId(model) ? model : DEFAULT_MODEL;
  const config = getModelConfig(modelId);
  const isBalsam = config?.provider === "balsam";

  const result = streamText({
    model: isBalsam ? balsam(modelId) : google(modelId),
    messages: await convertToModelMessages(messages),
    tools: {
      createArtifact,
    },
    stopWhen: stepCountIs(3),
    ...(!isBalsam && {
      providerOptions: {
        google: {
          thinkingConfig: {
            thinkingBudget: 8192,
            includeThoughts: true,
          },
        },
      },
    }),
    experimental_transform: smoothStream({ chunking: "word", delayInMs: 20 }),
  });

  return result.toUIMessageStreamResponse({
    sendReasoning: true,
  });
}
