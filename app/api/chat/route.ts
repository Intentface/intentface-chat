import { createOpenAI } from "@ai-sdk/openai";
import {
  convertToModelMessages,
  createUIMessageStream,
  createUIMessageStreamResponse,
  generateText,
  smoothStream,
  stepCountIs,
  streamText,
} from "ai";
import type { AppUIMessage } from "@/lib/ai/types";
import { readApiKey } from "@/lib/api-key";
import { DEFAULT_MODEL, isValidModelId } from "@/lib/models";
import { aggregateData } from "@/tools/aggregate-data";
import { askUser } from "@/tools/ask-user";
import { computeStats } from "@/tools/compute-stats";
import { connectDataSource } from "@/tools/connect-data-source";
import { createVisualization } from "@/tools/create-visualization";
import { detectAnomalies } from "@/tools/detect-anomalies";
import { exportReport } from "@/tools/export-report";
import { filterData } from "@/tools/filter-data";
import { listDataSources } from "@/tools/list-data-sources";
import { listDocsPages } from "@/tools/list-docs-pages";
import { queryData } from "@/tools/query-data";
import { readDocsPage } from "@/tools/read-docs-page";
import { readSourceFile } from "@/tools/read-source-file";
import { sortData } from "@/tools/sort-data";
import { webSearch } from "@/tools/web-search";

const SYSTEM_PROMPT = `You are the assistant in the Intentface Chat playground — a demo built with @intentface/chat, headless React chat primitives. You are knowledgeable, concise, and friendly.

## Response Guidelines
- Be concise and direct. Avoid unnecessary filler or preamble.
- Use markdown formatting for readability: headings, bold, lists, code blocks.
- When asked a question, answer it directly before providing additional context.
- If you don't know something, say so honestly rather than guessing.
- For code questions, provide working examples with brief explanations.
- Use the current date and time context when answering time-sensitive questions.

## Library Questions
When the user asks about @intentface/chat — its primitives (composer, thread, message, chip, steps, reasoning, attachments), installation, styling, state, or how this playground is built:
1. Call listDocsPages to see the documentation index
2. Read the relevant pages with readDocsPage before answering
3. For implementation internals ("how does X work under the hood"), read the code with readSourceFile — each docs page's source field names its component under packages/chat/src
- Answer strictly from the documentation and source — never invent props, exports, or APIs
- Link to pages inline using their url from the tool output, e.g. [Composer](/docs/primitives/composer)
- If the documentation doesn't cover something, say so instead of guessing

## Analytics Tools
You have access to analytics tools for exploring data sources. When asked to analyze data:
1. Start by calling listDataSources to discover what's available
2. Connect to a relevant source with connectDataSource
3. Query the data with queryData
4. Chain subsequent tools using IDs from previous outputs (e.g. queryId, aggregationId)
5. Think through each step — explain what you found and what to do next before calling the next tool
6. Build toward a visualization or report as the final deliverable

## Web Search & Citations
The webSearch tool returns structured "findings" — each finding has a "claim" and "sources" (with url and title).
- Write each claim naturally and cite it inline: claim text [domain](url)
- Use the exact URLs from sourceUrls — never fabricate URLs
- Never use numbered footnotes like [1], [2]
- Never create a separate "References" or "Sources" section
- Never place a period immediately after a citation link
- Never cite the same source more than once — after the first citation from a domain, omit further citations to it

## MANDATORY: Use askUser Tool for ALL Questions
You MUST call the askUser tool any time you need input from the user. This is NON-NEGOTIABLE.
- Need to clarify requirements? → call askUser
- Offering the user choices? → call askUser
- Asking "would you like…" or "do you prefer…"? → call askUser
- Listing options as bullet points? → call askUser instead
- Confirming before an action? → call askUser

DO NOT write questions, options, or bullet-listed choices as plain text. The user has an interactive UI for answering — use it. Call askUser with 2-5 concrete options, then STOP and wait.
`;

// Generate a sidebar title from the first user message with a small model.
// Runs concurrently with the main response; failures degrade to the client's
// truncated-text placeholder, never the stream.
type OpenAIProvider = ReturnType<typeof createOpenAI>;

const generateThreadTitle = async (
  message: AppUIMessage | undefined,
  openai: OpenAIProvider,
): Promise<string | null> => {
  // `messages` arrives untyped from the request body, so the last entry can be
  // absent — reading .parts off undefined would throw inside the stream and
  // surface as an opaque server error.
  const text = (message?.parts ?? [])
    .filter((part) => part.type === "text")
    .map((part) => part.text)
    .join("\n")
    .trim();
  if (!text) return null;

  try {
    const { text: title } = await generateText({
      model: openai("gpt-5-mini"),
      system:
        "Generate a title for a chat that opens with the given user message. 2-5 words, plain text — no quotes, no trailing punctuation.",
      prompt: text.slice(0, 2000),
      temperature: 0,
    });
    return title.trim() || null;
  } catch {
    return null;
  }
};

export async function POST(req: Request) {
  // The playground runs on the visitor's own key — there is no server key to
  // fall back to. The client branches on this status to open the key form.
  const apiKey = await readApiKey();
  if (!apiKey) {
    return Response.json(
      {
        error: "missing-api-key",
        message: "Add your own OpenAI API key in playground settings to start chatting.",
      },
      { status: 401 },
    );
  }
  const openai = createOpenAI({ apiKey });

  const {
    messages,
    model,
    webSearch: webSearchEnabled,
    thinking: thinkingEnabled,
  } = await req.json();

  const modelId = isValidModelId(model) ? model : DEFAULT_MODEL;

  const stream = createUIMessageStream<AppUIMessage>({
    // Without this the SDK replaces every failure with a generic string, which
    // makes a bad key, a rate limit and a model the key can't reach all look
    // identical. Log the reason server-side and hand the client something it can
    // act on. Only the message is logged — never the error object, which can
    // carry request headers, and therefore the key.
    onError: (error) => {
      const reason = error instanceof Error ? error.message : String(error);
      console.error("[api/chat]", reason);
      return reason;
    },
    execute: async ({ writer }) => {
      // First turn = no assistant message yet (tool-continuation rounds and
      // later turns always carry one). Kick the title off before the main
      // stream so it generates in parallel and lands mid-stream.
      const isFirstTurn = !messages.some((message: AppUIMessage) => message.role === "assistant");
      const titlePromise = isFirstTurn ? generateThreadTitle(messages.at(-1), openai) : null;

      const result = streamText({
        model: openai(modelId),
        system: SYSTEM_PROMPT,
        messages: await convertToModelMessages(messages),
        tools: {
          askUser,
          listDocsPages,
          readDocsPage,
          readSourceFile,
          listDataSources,
          connectDataSource,
          queryData,
          filterData,
          aggregateData,
          sortData,
          computeStats,
          detectAnomalies,
          createVisualization,
          exportReport,
          ...(webSearchEnabled && { webSearch }),
        },
        stopWhen: stepCountIs(15),
        ...(thinkingEnabled && {
          providerOptions: {
            openai: {
              reasoningEffort: "medium",
            },
          },
        }),
        experimental_transform: smoothStream({ chunking: "word", delayInMs: 20 }),
      });

      writer.merge(
        result.toUIMessageStream({
          sendReasoning: true,
          sendSources: true,
        }),
      );

      const title = await titlePromise;
      if (title) {
        writer.write({ type: "data-thread-title", data: { title }, transient: true });
      }
    },
  });

  return createUIMessageStreamResponse({ stream });
}
