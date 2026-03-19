import { tool } from "ai";
import { z } from "zod";
import { delay } from "@/tools/analytics-data";

export const aggregateData = tool({
  description:
    "Aggregate query results by grouping columns and computing metrics. Use a queryId from queryData or filterData.",
  inputSchema: z.object({
    queryId: z.string().describe("The query ID to aggregate"),
    groupBy: z.array(z.string()).describe("Columns to group by"),
    metrics: z
      .array(
        z.object({
          column: z.string(),
          function: z.enum(["sum", "avg", "count", "min", "max"]),
        }),
      )
      .describe("Metrics to compute for each group"),
  }),
  execute: async ({ queryId, groupBy, metrics }) => {
    await delay(300);
    const groups = [
      {
        group: { product: "Widget Pro" },
        values: { revenue_sum: 1938, units_sold_sum: 39, count: 5 },
      },
      {
        group: { product: "Gadget Plus" },
        values: { revenue_sum: 568, units_sold_sum: 10, count: 3 },
      },
      {
        group: { product: "Gizmo Basic" },
        values: { revenue_sum: 372, units_sold_sum: 12, count: 2 },
      },
    ];
    return {
      aggregationId: `agg-${queryId}`,
      groupBy,
      metrics,
      groups,
      summary: `${groups.length} groups computed`,
    };
  },
});
