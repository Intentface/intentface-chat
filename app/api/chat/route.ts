import { google } from "@ai-sdk/google";
import { convertToModelMessages, smoothStream, streamText } from "ai";

// Maximum duration for the API route (in seconds)
export const maxDuration = 30;

export async function POST(req: Request) {
  // Extract messages from the request body
  // Messages contain the conversation history (user and assistant messages)
  const { messages } = await req.json();

  const result = streamText({
    model: google("gemini-2.5-flash-lite"),
    messages: await convertToModelMessages(messages),
    experimental_transform: smoothStream({ chunking: "word", delayInMs: 20 }),
  });

  return result.toUIMessageStreamResponse();
}
