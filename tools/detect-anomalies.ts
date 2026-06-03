import { tool } from "ai";
import { z } from "zod";
import { delay, QUERY_ROWS } from "@/tools/analytics-data";

export const detectAnomalies = tool({
  description:
    "Detect anomalies in a numeric column using statistical methods. Use a queryId from queryData.",
  inputSchema: z.object({
    queryId: z.string().describe("The query ID to analyze"),
    column: z.string().describe("Numeric column to check for anomalies"),
    sensitivity: z.enum(["low", "medium", "high"]).describe("Detection sensitivity"),
  }),
  execute: async ({ queryId, column, sensitivity }) => {
    await delay(400);
    const values = QUERY_ROWS.map((r) => Number(r[column as keyof typeof r] ?? 0));
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    const threshold = sensitivity === "high" ? 0.8 : sensitivity === "medium" ? 1.2 : 1.5;
    const stddev = Math.sqrt(values.reduce((s, v) => s + (v - mean) ** 2, 0) / values.length);

    const anomalies = values
      .map((value, index) => ({
        index,
        value,
        zScore: Math.abs((value - mean) / stddev),
      }))
      .filter((a) => a.zScore > threshold)
      .map((a) => ({
        index: a.index,
        value: a.value,
        date: QUERY_ROWS[a.index]?.date,
        severity: a.zScore > 2 ? "high" : ("medium" as const),
        zScore: Math.round(a.zScore * 100) / 100,
      }));

    return {
      queryId,
      column,
      sensitivity,
      anomalies,
      summary: `${anomalies.length} anomalies detected`,
    };
  },
});
