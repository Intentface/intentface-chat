import { tool } from "ai";
import { z } from "zod";
import { delay, QUERY_ROWS } from "@/tools/analytics-data";

export const sortData = tool({
  description:
    "Sort query results by a column. Use a queryId from queryData or filterData.",
  inputSchema: z.object({
    queryId: z.string().describe("The query ID to sort"),
    column: z.string().describe("Column to sort by"),
    direction: z.enum(["asc", "desc"]).describe("Sort direction"),
  }),
  execute: async ({ queryId, column, direction }) => {
    await delay(150);
    const sorted = [...QUERY_ROWS].sort((a, b) => {
      const aVal = a[column as keyof typeof a] ?? 0;
      const bVal = b[column as keyof typeof b] ?? 0;
      return direction === "asc"
        ? Number(aVal) - Number(bVal)
        : Number(bVal) - Number(aVal);
    });
    return {
      sortedQueryId: `srt-${queryId}`,
      rows: sorted,
      summary: `Sorted by ${column} ${direction}`,
    };
  },
});
