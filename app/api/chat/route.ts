import { openai } from "@ai-sdk/openai";
import { convertToModelMessages, smoothStream, stepCountIs, streamText } from "ai";
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
import { queryData } from "@/tools/query-data";
import { sortData } from "@/tools/sort-data";
import { webSearch } from "@/tools/web-search";

const SYSTEM_PROMPT = `You are a helpful AI assistant. You are knowledgeable, concise, and friendly.

## Response Guidelines
- Be concise and direct. Avoid unnecessary filler or preamble.
- Use markdown formatting for readability: headings, bold, lists, code blocks.
- When asked a question, answer it directly before providing additional context.
- If you don't know something, say so honestly rather than guessing.
- For code questions, provide working examples with brief explanations.
- Use the current date and time context when answering time-sensitive questions.

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

export async function POST(req: Request) {
  const {
    messages,
    model,
    webSearch: webSearchEnabled,
    thinking: thinkingEnabled,
  } = await req.json();

  const modelId = isValidModelId(model) ? model : DEFAULT_MODEL;

  const result = streamText({
    model: openai(modelId),
    system: SYSTEM_PROMPT,
    messages: await convertToModelMessages(messages),
    tools: {
      askUser,
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

  return result.toUIMessageStreamResponse({
    sendReasoning: true,
    sendSources: true,
  });
}
