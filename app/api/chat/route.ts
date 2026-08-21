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
import { z } from "zod";
import type { AppUIMessage } from "@/lib/ai/types";
import { readApiKey } from "@/lib/api-key";
import { DEFAULT_MODEL, isValidModelId } from "@/lib/models";
import { askUser } from "@/tools/ask-user";
import { listDocsPages } from "@/tools/list-docs-pages";
import { readDocsPage } from "@/tools/read-docs-page";
import { readSourceFile } from "@/tools/read-source-file";
import { createWebSearch } from "@/tools/web-search";

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
- Link to pages inline using their url from the tool output, e.g. [Composer](/primitives/composer)
- If the documentation doesn't cover something, say so instead of guessing

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
  // The schema guarantees a non-empty array but not the shape of its items, so
  // `parts` can still be missing — reading it unguarded throws inside the stream.
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

// Untyped body: a bad shape should fail here as a 400, not inside the stream as a 500.
const chatRequestSchema = z.object({
  messages: z.array(z.any()).min(1),
  model: z.string().optional(),
  webSearch: z.boolean().optional(),
  thinking: z.boolean().optional(),
});

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

  const parsed = chatRequestSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ error: "invalid-request" }, { status: 400 });
  }

  const { messages, model, webSearch: webSearchEnabled, thinking: thinkingEnabled } = parsed.data;

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
          ...(webSearchEnabled && { webSearch: createWebSearch(openai) }),
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
