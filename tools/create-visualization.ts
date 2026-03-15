import { tool } from "ai";
import { z } from "zod";
import { delay } from "@/tools/analytics-data";

export const createVisualization = tool({
  description:
    "Create a visualization from query results or aggregations. Use a sourceId from queryData, aggregateData, sortData, etc.",
  inputSchema: z.object({
    sourceId: z.string().describe("The query/aggregation/sort ID to visualize"),
    chartType: z
      .enum(["bar", "line", "pie", "scatter", "area"])
      .describe("Type of chart"),
    title: z.string().describe("Chart title"),
  }),
  execute: async ({ sourceId, chartType, title }) => {
    await delay(300);
    return {
      vizId: `viz-${sourceId}`,
      chartType,
      title,
      dataPoints: 10,
      summary: `Created ${chartType} chart: "${title}"`,
    };
  },
});
