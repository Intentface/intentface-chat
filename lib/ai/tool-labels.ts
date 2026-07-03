import type { ToolLabels } from "@intentface/chat/message-utils";

// Maps this app's tool names to human-readable labels for the steps UI.

export const DEFAULT_TOOL_LABELS: ToolLabels = {
  webSearch: {
    active: (i) => `Searching for '${i.query ?? ""}'`,
    complete: (i) => `Searched for '${i.query ?? ""}'`,
  },
  createArtifact: {
    active: (i) => `Creating '${i.title ?? "Untitled"}'`,
    complete: (i) => `Created '${i.title ?? "Untitled"}'`,
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
