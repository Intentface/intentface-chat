import { tool } from "ai";
import { z } from "zod";
import { delay, QUERY_ROWS } from "@/tools/analytics-data";

export const queryData = tool({
  description:
    "Run a query against a connected data source. Returns columns and rows. Use a connectionId from connectDataSource.",
  inputSchema: z.object({
    connectionId: z
      .string()
      .describe("The connection ID from connectDataSource"),
    query: z
      .string()
      .describe(
        "Natural language or SQL-like query describing what data to retrieve",
      ),
  }),
  execute: async ({ connectionId }) => {
    await delay(350);
    return {
      queryId: `qry-${connectionId}-${Date.now()}`,
      columns: ["date", "product", "region", "revenue", "units_sold"],
      rows: QUERY_ROWS,
      totalRows: QUERY_ROWS.length,
      summary: `${QUERY_ROWS.length} rows returned`,
    };
  },
});
