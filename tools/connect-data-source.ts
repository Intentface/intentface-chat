import { tool } from "ai";
import { z } from "zod";
import { delay, SAMPLE_ROWS, SCHEMA, SOURCES } from "@/tools/analytics-data";

export const connectDataSource = tool({
  description:
    "Connect to a specific data source by its ID. Returns the schema and sample rows. Use an ID from listDataSources.",
  inputSchema: z.object({
    sourceId: z.string().describe("The data source ID to connect to"),
  }),
  execute: async ({ sourceId }) => {
    await delay(300);
    const source = SOURCES.find((s) => s.id === sourceId);
    return {
      connectionId: `conn-${sourceId}`,
      sourceName: source?.name ?? sourceId,
      schema: SCHEMA,
      sampleRows: SAMPLE_ROWS,
      summary: `Connected, ${SCHEMA.length} columns`,
    };
  },
});
