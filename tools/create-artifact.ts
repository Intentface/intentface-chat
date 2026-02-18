import { tool } from "ai";
import { z } from "zod";

export const createArtifact = tool({
  description:
    "Create a document artifact displayed in a side panel. Use for long-form content, guides, structured documents, or any content that benefits from a dedicated view.",
  inputSchema: z.object({
    title: z.string().describe("Title of the artifact"),
    content: z.string().describe("Markdown content of the artifact"),
  }),
  execute: async ({ title, content }) => ({ title, content }),
});
