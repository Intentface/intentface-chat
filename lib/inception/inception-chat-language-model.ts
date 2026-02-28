import type {
  LanguageModelV3,
  LanguageModelV3CallOptions,
  LanguageModelV3Content,
  LanguageModelV3FinishReason,
  LanguageModelV3GenerateResult,
  LanguageModelV3StreamPart,
  LanguageModelV3StreamResult,
  LanguageModelV3Usage,
  SharedV3Warning,
} from "@ai-sdk/provider";
import type { InceptionChatSettings } from "./inception-chat-settings";

type InceptionChatConfig = {
  provider: string;
  baseURL: string;
  headers: () => Record<string, string>;
};

type OpenAIMessage = {
  role: string;
  content: string | Array<{ type: string; text?: string }>;
  tool_calls?: Array<{
    id: string;
    type: "function";
    function: { name: string; arguments: string };
  }>;
  tool_call_id?: string;
};

export class InceptionChatLanguageModel implements LanguageModelV3 {
  readonly specificationVersion = "v3" as const;
  readonly provider: string;
  readonly modelId: string;
  readonly supportedUrls: Record<string, RegExp[]> = {};

  private readonly settings: InceptionChatSettings;
  private readonly config: InceptionChatConfig;

  constructor(
    modelId: string,
    settings: InceptionChatSettings,
    config: InceptionChatConfig,
  ) {
    this.modelId = modelId;
    this.settings = settings;
    this.config = config;
    this.provider = config.provider;
  }

  private convertPrompt(
    prompt: LanguageModelV3CallOptions["prompt"],
  ): OpenAIMessage[] {
    const messages: OpenAIMessage[] = [];

    for (const message of prompt) {
      switch (message.role) {
        case "system":
          messages.push({ role: "system", content: message.content });
          break;

        case "user":
          messages.push({
            role: "user",
            content: message.content
              .filter(
                (part): part is Extract<typeof part, { type: "text" }> =>
                  part.type === "text",
              )
              .map((part) => part.text)
              .join(""),
          });
          break;

        case "assistant": {
          let text = "";
          const toolCalls: NonNullable<OpenAIMessage["tool_calls"]> = [];

          for (const part of message.content) {
            if (part.type === "text") text += part.text;
            if (part.type === "tool-call") {
              toolCalls.push({
                id: part.toolCallId,
                type: "function",
                function: {
                  name: part.toolName,
                  arguments:
                    typeof part.input === "string"
                      ? part.input
                      : JSON.stringify(part.input),
                },
              });
            }
          }

          const msg: OpenAIMessage = { role: "assistant", content: text };
          if (toolCalls.length > 0) msg.tool_calls = toolCalls;
          messages.push(msg);
          break;
        }

        case "tool":
          for (const part of message.content) {
            if (part.type === "tool-result") {
              let value: string;
              if (part.output.type === "text") {
                value = part.output.value;
              } else if (part.output.type === "json") {
                value = JSON.stringify(part.output.value);
              } else {
                value = "";
              }
              messages.push({
                role: "tool",
                tool_call_id: part.toolCallId,
                content: value,
              });
            }
          }
          break;
      }
    }

    return messages;
  }

  private buildRequestBody(options: LanguageModelV3CallOptions) {
    const warnings: SharedV3Warning[] = [];
    const messages = this.convertPrompt(options.prompt);

    const tools = options.tools
      ?.map((tool) => {
        if (tool.type === "function") {
          return {
            type: "function" as const,
            function: {
              name: tool.name,
              description: tool.description,
              parameters: tool.inputSchema,
            },
          };
        }
        warnings.push({
          type: "unsupported",
          feature: `tool type: ${tool.type}`,
        });
        return null;
      })
      .filter(Boolean);

    let toolChoice:
      | string
      | { type: string; function?: { name: string } }
      | undefined;
    if (options.toolChoice) {
      if (options.toolChoice.type === "tool") {
        toolChoice = {
          type: "function",
          function: { name: options.toolChoice.toolName },
        };
      } else {
        toolChoice = options.toolChoice.type;
      }
    }

    const body: Record<string, unknown> = {
      model: this.modelId,
      messages,
      ...(options.maxOutputTokens != null && {
        max_tokens: options.maxOutputTokens,
      }),
      ...(options.temperature != null && { temperature: options.temperature }),
      ...(options.stopSequences != null && { stop: options.stopSequences }),
      ...(tools && tools.length > 0 && { tools }),
      ...(toolChoice && { tool_choice: toolChoice }),
      // Inception-specific parameters
      ...(this.settings.reasoningEffort != null && {
        reasoning_effort: this.settings.reasoningEffort,
      }),
      ...(this.settings.reasoningSummary != null && {
        reasoning_summary: this.settings.reasoningSummary,
      }),
      ...(this.settings.reasoningSummaryWait != null && {
        reasoning_summary_wait: this.settings.reasoningSummaryWait,
      }),
    };

    if (options.responseFormat?.type === "json") {
      body.response_format = { type: "json_object" };
    }

    return { body, warnings };
  }

  private mapFinishReason(reason: string | null): LanguageModelV3FinishReason {
    const map: Record<string, LanguageModelV3FinishReason["unified"]> = {
      stop: "stop",
      length: "length",
      tool_calls: "tool-calls",
      content_filter: "content-filter",
    };
    return {
      unified: map[reason ?? ""] ?? "other",
      raw: reason ?? undefined,
    };
  }

  private mapUsage(usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
    total_tokens?: number;
  }): LanguageModelV3Usage {
    return {
      inputTokens: {
        total: usage?.prompt_tokens,
        noCache: undefined,
        cacheRead: undefined,
        cacheWrite: undefined,
      },
      outputTokens: {
        total: usage?.completion_tokens,
        text: undefined,
        reasoning: undefined,
      },
    };
  }

  async doGenerate(
    options: LanguageModelV3CallOptions,
  ): Promise<LanguageModelV3GenerateResult> {
    const { body, warnings } = this.buildRequestBody(options);

    const response = await fetch(`${this.config.baseURL}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...this.config.headers(),
      },
      body: JSON.stringify(body),
      signal: options.abortSignal,
    });

    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(`Inception API error (${response.status}): ${errorBody}`);
    }

    const data = await response.json();
    const choice = data.choices?.[0];
    const content: LanguageModelV3Content[] = [];

    if (choice?.message?.content) {
      content.push({ type: "text", text: choice.message.content });
    }

    if (choice?.message?.tool_calls) {
      for (const toolCall of choice.message.tool_calls) {
        content.push({
          type: "tool-call",
          toolCallId: toolCall.id,
          toolName: toolCall.function.name,
          input: toolCall.function.arguments,
        });
      }
    }

    return {
      content,
      finishReason: this.mapFinishReason(choice?.finish_reason ?? null),
      usage: this.mapUsage(data.usage),
      request: { body },
      response: { body: data },
      warnings,
    };
  }

  async doStream(
    options: LanguageModelV3CallOptions,
  ): Promise<LanguageModelV3StreamResult> {
    const { body, warnings } = this.buildRequestBody(options);
    const isDiffusing = this.settings.diffusing === true;

    const requestBody = {
      ...body,
      stream: true,
      ...(isDiffusing && { diffusing: true }),
      stream_options: { include_usage: true },
    };

    const response = await fetch(`${this.config.baseURL}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...this.config.headers(),
      },
      body: JSON.stringify(requestBody),
      signal: options.abortSignal,
    });

    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(`Inception API error (${response.status}): ${errorBody}`);
    }

    const textId = generateId();
    const stream = this.createSSEStream(
      response,
      warnings,
      isDiffusing,
      textId,
    );

    return { stream, request: { body: requestBody } };
  }

  private createSSEStream(
    response: Response,
    warnings: SharedV3Warning[],
    isDiffusing: boolean,
    textId: string,
  ): ReadableStream<LanguageModelV3StreamPart> {
    const reader = response.body!.getReader();
    const decoder = new TextDecoder();
    const mapFinishReason = this.mapFinishReason.bind(this);
    const mapUsage = this.mapUsage.bind(this);

    let buffer = "";
    let isFirstChunk = true;
    let textStarted = false;
    let previousContent = "";
    const toolCallStarted = new Set<number>();

    return new ReadableStream<LanguageModelV3StreamPart>({
      async pull(controller) {
        while (true) {
          const { done, value } = await reader.read();

          if (done) {
            if (textStarted) {
              controller.enqueue({ type: "text-end", id: textId });
            }
            controller.close();
            return;
          }

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

            if (isFirstChunk) {
              controller.enqueue({ type: "stream-start", warnings });
              isFirstChunk = false;
            }

            const choices = chunk.choices as
              | Array<Record<string, unknown>>
              | undefined;
            const choice = choices?.[0];

            if (!choice) {
              // Usage-only chunk (final chunk with stream_options)
              const usage = chunk.usage as Record<string, number> | undefined;
              if (usage) {
                controller.enqueue({
                  type: "finish",
                  finishReason: mapFinishReason("stop"),
                  usage: mapUsage(usage),
                });
              }
              continue;
            }

            const delta = choice.delta as Record<string, unknown> | undefined;
            if (!delta) continue;

            // Handle text content
            const content = delta.content as string | null | undefined;
            if (content != null && content !== "") {
              if (!textStarted) {
                controller.enqueue({ type: "text-start", id: textId });
                textStarted = true;
              }

              if (isDiffusing) {
                // In diffusion mode, delta.content is the FULL text each time.
                // Compute incremental diff when possible.
                if (content.startsWith(previousContent)) {
                  const newPart = content.slice(previousContent.length);
                  if (newPart) {
                    controller.enqueue({
                      type: "text-delta",
                      id: textId,
                      delta: newPart,
                    });
                  }
                } else {
                  // Content changed (denoising refinement) — restart text
                  controller.enqueue({ type: "text-end", id: textId });
                  controller.enqueue({ type: "text-start", id: textId });
                  controller.enqueue({
                    type: "text-delta",
                    id: textId,
                    delta: content,
                  });
                }
                previousContent = content;
              } else {
                // Standard streaming — delta.content is incremental
                controller.enqueue({
                  type: "text-delta",
                  id: textId,
                  delta: content,
                });
              }
            }

            // Handle tool calls
            const toolCalls = delta.tool_calls as
              | Array<{
                  index: number;
                  id?: string;
                  function?: { name?: string; arguments?: string };
                }>
              | undefined;

            if (toolCalls) {
              for (const tc of toolCalls) {
                if (
                  !toolCallStarted.has(tc.index) &&
                  tc.id &&
                  tc.function?.name
                ) {
                  toolCallStarted.add(tc.index);
                  if (textStarted) {
                    controller.enqueue({ type: "text-end", id: textId });
                    textStarted = false;
                  }
                  controller.enqueue({
                    type: "tool-input-start",
                    id: tc.id,
                    toolName: tc.function.name,
                  });
                }
                if (tc.function?.arguments) {
                  controller.enqueue({
                    type: "tool-input-delta",
                    id: tc.id ?? `tool-${tc.index}`,
                    delta: tc.function.arguments,
                  });
                }
              }
            }

            // Handle finish reason
            const finishReason = choice.finish_reason as string | null;
            if (finishReason) {
              if (textStarted) {
                controller.enqueue({ type: "text-end", id: textId });
                textStarted = false;
              }

              // Close any open tool inputs
              for (const idx of toolCallStarted) {
                controller.enqueue({
                  type: "tool-input-end",
                  id: `tool-${idx}`,
                });
              }

              const usage = chunk.usage as Record<string, number> | undefined;
              controller.enqueue({
                type: "finish",
                finishReason: mapFinishReason(finishReason),
                usage: mapUsage(usage),
              });
            }
          }
        }
      },
    });
  }
}

let idCounter = 0;
const generateId = () => `inception-${Date.now()}-${idCounter++}`;
