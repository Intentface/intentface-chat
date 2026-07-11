// Maps this app's tool names to human-readable labels for the steps UI.

/**
 * Maps tool names (the part type minus its `tool-` prefix) to human-readable
 * labels. Each entry provides an active (in-progress) and complete (finished)
 * label generator that receives the tool's input for dynamic text.
 */
export type ToolLabels = Record<
  string,
  {
    active: (input: Record<string, unknown>) => string;
    complete: (input: Record<string, unknown>) => string;
  }
>;

export const DEFAULT_TOOL_LABELS: ToolLabels = {
  listDocsPages: {
    active: () => "Browsing the documentation",
    complete: () => "Browsed the documentation",
  },
  readDocsPage: {
    active: (i) => `Reading docs: ${i.slug ?? "page"}`,
    complete: (i) => `Read docs: ${i.slug ?? "page"}`,
  },
  readSourceFile: {
    active: (i) =>
      i.path && i.path !== "." ? `Reading source: ${i.path}` : "Listing source files",
    complete: (i) => (i.path && i.path !== "." ? `Read source: ${i.path}` : "Listed source files"),
  },
  webSearch: {
    active: (i) => `Searching for '${i.query ?? ""}'`,
    complete: (i) => `Searched for '${i.query ?? ""}'`,
  },
  listDataSources: {
    active: () => "Discovering data sources",
    complete: () => "Discovered data sources",
  },
  connectDataSource: {
    active: (i) => `Connecting to ${i.sourceId ?? "source"}`,
    complete: (i) => `Connected to ${i.sourceId ?? "source"}`,
  },
  queryData: {
    active: () => "Querying data",
    complete: () => "Queried data",
  },
  filterData: {
    active: () => "Filtering results",
    complete: () => "Filtered results",
  },
  aggregateData: {
    active: () => "Aggregating data",
    complete: () => "Aggregated data",
  },
  sortData: {
    active: (i) => `Sorting by ${i.column ?? "column"}`,
    complete: (i) => `Sorted by ${i.column ?? "column"}`,
  },
  computeStats: {
    active: (i) => `Computing stats for ${i.column ?? "column"}`,
    complete: (i) => `Computed stats for ${i.column ?? "column"}`,
  },
  detectAnomalies: {
    active: (i) => `Detecting anomalies in ${i.column ?? "column"}`,
    complete: (i) => `Detected anomalies in ${i.column ?? "column"}`,
  },
  createVisualization: {
    active: (i) => `Creating ${i.chartType ?? ""} chart`,
    complete: (i) => `Created ${i.chartType ?? ""} chart`,
  },
  exportReport: {
    active: (i) => `Exporting report "${i.title ?? ""}"`,
    complete: (i) => `Exported report "${i.title ?? ""}"`,
  },
};
