import { tool } from "ai";
import { z } from "zod";
import { delay, QUERY_ROWS } from "@/tools/analytics-data";

export const computeStats = tool({
  description:
    "Compute descriptive statistics for a numeric column. Use a queryId from queryData or filterData.",
  inputSchema: z.object({
    queryId: z.string().describe("The query ID to analyze"),
    column: z.string().describe("Numeric column to compute stats for"),
  }),
  execute: async ({ queryId, column }) => {
    await delay(250);
    const values = QUERY_ROWS.map((r) => Number(r[column as keyof typeof r] ?? 0));
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    const sorted = [...values].sort((a, b) => a - b);
    const median = sorted[Math.floor(sorted.length / 2)] ?? 0;
    const variance = values.reduce((sum, v) => sum + (v - mean) ** 2, 0) / values.length;
    return {
      queryId,
      column,
      mean: Math.round(mean * 100) / 100,
      median,
      stddev: Math.round(Math.sqrt(variance) * 100) / 100,
      min: Math.min(...values),
      max: Math.max(...values),
      summary: `Mean ${Math.round(mean)}, range ${Math.min(...values)}–${Math.max(...values)}`,
    };
  },
});
