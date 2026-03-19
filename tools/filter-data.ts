import { tool } from "ai";
import { z } from "zod";
import { delay, QUERY_ROWS } from "@/tools/analytics-data";

export const filterData = tool({
  description:
    "Filter query results by column conditions. Use a queryId from queryData.",
  inputSchema: z.object({
    queryId: z.string().describe("The query ID from queryData"),
    filters: z
      .array(
        z.object({
          column: z.string(),
          operator: z.enum(["eq", "neq", "gt", "lt", "gte", "lte", "contains"]),
          value: z.union([z.string(), z.number()]),
        }),
      )
      .describe("Filter conditions to apply"),
  }),
  execute: async ({ queryId, filters }) => {
    await delay(200);
    const filtered = QUERY_ROWS.filter((row) =>
      filters.every((f) => {
        const val = row[f.column as keyof typeof row];
        if (f.operator === "eq") return val === f.value;
        if (f.operator === "gt") return Number(val) > Number(f.value);
        if (f.operator === "lt") return Number(val) < Number(f.value);
        if (f.operator === "contains")
          return String(val).includes(String(f.value));
        return true;
      }),
    );
    return {
      filteredQueryId: `flt-${queryId}`,
      rows: filtered,
      matchingRows: filtered.length,
      summary: `${filtered.length} rows match filters`,
    };
  },
});
