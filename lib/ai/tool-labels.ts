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
};
