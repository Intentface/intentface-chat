import { tool } from "ai";
import { z } from "zod";
import { delay, SOURCES } from "@/tools/analytics-data";

export const listDataSources = tool({
  description:
    "List all available data sources. Call this first to discover what data is available before connecting.",
  inputSchema: z.object({}),
  execute: async () => {
    await delay(200);
    return {
      sources: SOURCES,
      summary: `Found ${SOURCES.length} data sources`,
    };
  },
});
