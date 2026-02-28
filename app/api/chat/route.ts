import { google } from "@ai-sdk/google";
import { createOpenAI } from "@ai-sdk/openai";
import type { UIMessage } from "ai";
import {
  convertToModelMessages,
  createUIMessageStream,
  createUIMessageStreamResponse,
  smoothStream,
  stepCountIs,
  streamText,
} from "ai";
import { inception } from "@/lib/inception";
import { DEFAULT_MODEL, getModelConfig, isValidModelId } from "@/lib/models";
import { createArtifact } from "@/tools/create-artifact";

const balsam = createOpenAI({
  baseURL: "http://localhost:8800/v1",
  apiKey: "anything",
});

const getModel = (modelId: string, provider: string | undefined) => {
  switch (provider) {
    case "inception":
      if (modelId === "mercury-2-diffusing") {
        return inception("mercury-2", { diffusing: true });
      }
      if (modelId === "mercury-2-instant") {
        return inception("mercury-2", { reasoningEffort: "instant" });
      }
      return inception(modelId);
    case "balsam":
      return balsam(modelId);
    default:
      return google(modelId);
  }
};

/**
 * Convert UIMessages to simple OpenAI-compatible messages for direct API calls.
 */
const toOpenAIMessages = (messages: UIMessage[]) =>
  messages.map((m) => ({
    role: m.role,
    content:
      m.parts
        .filter(
          (p): p is Extract<typeof p, { type: "text" }> => p.type === "text",
        )
        .map((p) => p.text)
        .join("") || "",
  }));

/**
 * Handle diffusion streaming by calling Inception API directly.
 *
 * Each diffusion snapshot (full replacement text) is sent as a separate
 * text-start/text-delta/text-end cycle. The client renders only the last
 * text part, creating the visual denoising effect as text resolves.
 */
const handleDiffusionStream = (messages: UIMessage[]) => {
  const apiKey = process.env.INCEPTION_API_KEY;
  if (!apiKey) {
    throw new Error("INCEPTION_API_KEY environment variable is required");
  }

  const stream = createUIMessageStream({
    execute: async ({ writer }) => {
      const response = await fetch(
        "https://api.inceptionlabs.ai/v1/chat/completions",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${apiKey}`,
          },
          body: JSON.stringify({
            model: "mercury-2",
            messages: toOpenAIMessages(messages),
            stream: true,
            diffusing: true,
            stream_options: { include_usage: true },
          }),
        },
      );

      if (!response.ok) {
        const errorBody = await response.text();
        throw new Error(
          `Inception API error (${response.status}): ${errorBody}`,
        );
      }

      if (!response.body) {
        throw new Error("Inception API returned no response body");
      }
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let snapshotIndex = 0;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || !trimmed.startsWith("data: ")) continue;
          if (trimmed === "data: [DONE]") continue;

          const jsonStr = trimmed.slice(6);
          if (!jsonStr.startsWith("{")) continue;

          let chunk: Record<string, unknown>;
          try {
            chunk = JSON.parse(jsonStr);
          } catch {
            continue;
          }

          const choices = chunk.choices as
            | Array<Record<string, unknown>>
            | undefined;
          const choice = choices?.[0];

          if (choice) {
            const delta = choice.delta as Record<string, unknown> | undefined;
            const content = delta?.content as string | null | undefined;

            if (content != null && content !== "") {
              // Each snapshot is a full text replacement — send as a
              // separate text part so the client can show the latest one.
              const textId = `diffusion-${snapshotIndex++}`;
              writer.write({ type: "text-start", id: textId });
              writer.write({
                type: "text-delta",
                delta: content,
                id: textId,
              });
              writer.write({ type: "text-end", id: textId });
            }
          }
        }
      }

      writer.write({ type: "finish", finishReason: "stop" });
    },
    originalMessages: messages,
  });

  return createUIMessageStreamResponse({ stream });
};

export async function POST(req: Request) {
  const { messages, model } = await req.json();

  const modelId = isValidModelId(model) ? model : DEFAULT_MODEL;
  const config = getModelConfig(modelId);
  const provider = config?.provider;
  const isGoogle = provider === "google" || !provider;
  const isDiffusing = modelId === "mercury-2-diffusing";

  // Diffusion models get a custom stream with data-diffusion parts
  if (isDiffusing) {
    return handleDiffusionStream(messages);
  }

  const result = streamText({
    model: getModel(modelId, provider),
    messages: await convertToModelMessages(messages),
    tools: {
      createArtifact,
    },
    stopWhen: stepCountIs(3),
    ...(isGoogle && {
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
