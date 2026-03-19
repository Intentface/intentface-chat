import { tool } from "ai";
import { z } from "zod";
import { delay } from "@/tools/analytics-data";

export const exportReport = tool({
  description:
    "Export an analysis report combining visualizations and insights. This is typically the final step.",
  inputSchema: z.object({
    title: z.string().describe("Report title"),
    sections: z
      .array(
        z.object({
          heading: z.string(),
          content: z.string(),
          vizId: z.string().optional(),
        }),
      )
      .describe("Report sections with optional visualization references"),
  }),
  execute: async ({ title, sections }) => {
    await delay(250);
    return {
      reportId: `rpt-${Date.now()}`,
      title,
      sectionCount: sections.length,
      url: `https://reports.example.com/rpt-${Date.now()}`,
      summary: `Report "${title}" exported (${sections.length} sections)`,
    };
  },
});
